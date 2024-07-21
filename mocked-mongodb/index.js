const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");

const dbConnection = process.env.DB_CONNECTION || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "my-test-project";
const port = (process.env.PORT && parseInt(process.env.PORT)) || 3000;

//
// Starts the express server.
//
async function startServer(config, db) {
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
            })
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

    return await startServer(config, db);
}

if (require.main === module) {
    //
    // A normal run.
    //
    main({ dbConnection, dbName, port })
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

