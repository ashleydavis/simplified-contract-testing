const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const amqp = require("amqplib");

const dbConnection = process.env.DB_CONNECTION || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "my-test-project";
const port = (process.env.PORT && parseInt(process.env.PORT)) || 3000;
const messagingHost = process.env.MESSAGING_HOST || "amqp://guest:guest@rabbit:5672";
const postAddedExchange = process.env.POST_ADDED_EXCHANGE || "post-added";
const newUserExchange = process.env.POST_ADDED_EXCHANGE || "new-user";
const paymentProcessedExchange = process.env.POST_ADDED_EXCHANGE || "payment-processed";

//
// Starts the express server.
//
async function startServer(config, db, messagingChannel, newUserQueue) {
    return new Promise(resolve => {
        const app = express();
        app.use(express.json());

        app.get("/posts/:postId?", async (req, res) => {
            const postId = (req.params.postId && new ObjectId(req.params.postId)) || undefined;
            if (postId) {
                const post = await db.collection("posts").findOne({ _id: postId });
                if (!post) {
                    res.sendStatus(404);
                }
                else {
                    res.json(post);
                }
            }
            else {
                const posts = await db.collection("posts").find().toArray();
                res.json(posts);
            }
        });

        app.post("/posts", async (req, res) => {
            const { userId, title, body } = req.body;
            if (!userId || !title || !body) { // Some very simple validation.
                res.sendStatus(400);
                return;
            }

            const result = await db.collection("posts").insertOne({ userId, title, body });
            res.status(201).json({
                _id: result.insertedId.toString(),
            });

            const msg = {
                postId: result.insertedId,
                userId,
            };        

            console.log("Sending message to exchange " + postAddedExchange);
            console.log("Payload:");
            console.log(msg);

            messagingChannel.publish(postAddedExchange, '', Buffer.from(JSON.stringify(msg)));
        });

        //
        // Receives messages from the new user queue.
        //
        consumeMessages(messagingChannel, newUserQueue,
            messagePayload => {
                console.log("New user: ");
                console.log(messagePayload);

                //
                // --snip-- Process the payment for the user.
                //

                const msg = {
                    userId: messagePayload.userId,
                };        
    
                console.log("Sending message to exchange " + paymentProcessedExchange);
                console.log("Payload:");
                console.log(msg);
    
                messagingChannel.publish(paymentProcessedExchange, '', Buffer.from(JSON.stringify(msg)));
            }
        )
        .catch(err => { //todo: Be better to have an await on this, but have to restructure.
            console.error(`Failed to consume messages for queue ${newUserQueue}`);
            console.error(err && err.stack || err);
        });

        const server = app.listen(config.port, () => {
            resolve(server);
        });
    });
}

async function main(config) {
    
    const client = new MongoClient(config.dbConnection);
    await client.connect();
    const db = client.db(config.dbName);

    const messagingConnection = await amqp.connect(config.messagingHost);
    const messagingChannel = await messagingConnection.createChannel();
    
    await messagingChannel.assertExchange(postAddedExchange, "fanout");

    await messagingChannel.assertExchange(paymentProcessedExchange, "fanout");

    const response = await messagingChannel.assertQueue("", {});
    const newUserQueue = response.queue;
    await messagingChannel.bindQueue(newUserQueue, newUserExchange, "");

    return await startServer(config, db, messagingChannel, newUserQueue);
}

//
// Handles incoming messages.
//
async function consumeMessages(messagingChannel, queueName, handler) {

    await messagingChannel.consume(queueName, (msg) => {

        const messagePayload = JSON.parse(msg.content.toString())

        try {
            const promise = handler(messagePayload);
            if (promise) {
                promise.then(() => {
                        messagingChannel.ack(msg);
                        console.log(queueName + " async handler done.");
                    })
                    .catch(err => {
                        console.error(queueName + " async handler errored.");
                        console.error(err && err.stack || err);
                    });
            }
            else {
                messagingChannel.ack(msg);
                console.log(queueName + " handler done.");
            }
        }
        catch (err) {
            console.error(queueName + " handler errored.");
            console.error(err && err.stack || err);
        }
    });

    console.log(`Receiving messages from queue ${queueName}`);
}

if (require.main === module) {
    //
    // A normal run.
    //
    main({ dbConnection, dbName, port, messagingHost })
        .catch(err => {
            console.error(`Something went wrong:`);
            console.error(err.stack);
        });
}
else {
    //
    // Invoked from tests.
    //
    module.exports = {
        main,
    }
}

