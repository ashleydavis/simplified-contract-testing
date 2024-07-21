const axios = require("axios");
const mongodb = require("mongodb");
const amqplib = require("amqplib");
const yaml = require("yaml");
const fs = require("fs");
const { resolveRefs } = require("./lib/resolver");
const { main } = require("../index");

const { matchers } = require("jest-json-schema");
expect.extend(matchers);

describe("Contract tests", () => {

    //
    // Note: the test spec must be loaded syncronously because jest does not support async test generation.
    //
    const testSpec = resolveRefs(yaml.parse(fs.readFileSync(`${__dirname}/test-spec.yaml`, 'utf-8')));

    let server;
    let baseURL;

    //
    // Loads a test data fixture.
    //
    async function loadFixture(fixtureName) {
        const fixtureFiles = await fs.promises.readdir(`./fixtures/${fixtureName}`);
        const fixtures = {};
        for (const fixtureFile of fixtureFiles) {
            const collectionName = fixtureFile.split(".")[0];
            fixtures[collectionName] = require(`../fixtures/${fixtureName}/${fixtureFile}`);
        }
        mongodb.__setData__(fixtures);
    }

    //
    // Removes all test data.
    //
    function clearFixture() {
        mongodb.__setData__({});
    }   

    //
    // Starts the server on a random port.
    //
    async function startServer() {
        if (process.env.BASE_URL) {
            //
            // Run against an existing server that is started externally.
            //
            baseURL = process.env.BASE_URL;
        }
        else {
            //
            // Run against a server that is started internally for each test.
            //
            server = await main({
                dbConnection: `mongodb://127.0.0.1:1234`,
                dbName: `contract-tests`,
                port: 0, // Allocates a random port.
            });

            baseURL = `http://127.0.0.1:${server.address().port}`;
        }
    }

    //
    // Closes the server.
    //
    function closeServer() {
        return new Promise(resolve => {
            if (server) {
                server.close(resolve);
            }
            else {
                resolve();
            }
        })
    }

    beforeEach(async () => {
        await startServer();

    });

    afterEach(async () => {
        await closeServer();
    });

    //
    // Makes the HTTP request.
    //
    async function http(spec) {
        return await axios({
            method: spec.method,
            url: spec.url,
            baseURL,
            data: spec.body,
            validateStatus: () => true, // All status codes are ok.
        });
    }

    //
    // Makes an async request by simulating publishing a message to the exchange.
    //
    async function rabbit(spec) {
        const queue = amqplib.__queue_bindings__[spec.exchange];
        if (!queue) {
            throw new Error(`No queue is bound for exchange '${spec.exchange}'`);
        }

        const consumeHandler = amqplib.__consume__[queue];
        if (!consumeHandler) {
            throw new Error(`No consumer found for queue '${queue}' bound to exchange '${spec.exchange}'`);
        }

        consumeHandler({ content: Buffer.from(JSON.stringify(spec.body)) });
    }

    const triggers = {
        http,
        rabbit,
    };

    test.each(testSpec.specs)(`$title`, async spec => { // Generates a test for each test spec in the contract.

        if (spec.fixture) {
            loadFixture(spec.fixture)
        }
        else {
            clearFixture();
        }

        if (!spec.title) {
            throw new Error("A title is required for each test spec.");
        }

        if (!spec.type) {
            throw new Error(`'type' is required for '${spec.title}'`);
        }

        const trigger = triggers[spec.type];
        if (!trigger) {
            throw new Error(`Unsupported trigger type: ${spec.type}`);
        }

        //
        // Trigger the request.
        //
        const immediateResponse = await trigger(spec);

        //
        // Match the immedate response against the expected schema.
        //
        if (spec.expected.immediateResponse) {
            //
            // Match status
            //
            if (spec.expected.immediateResponse.status) {
                expect(immediateResponse.status).toEqual(spec.expected.immediateResponse.status);
            }

            //
            // Match headers.
            //
            if (spec.expected.immediateResponse.headers) {
                for ([headerName, expectedValue] of Object.entries(spec.expected.immediateResponse.headers)) {
                    const actualValue = immediateResponse.headers[headerName.toLowerCase()]
                    expect(actualValue).toEqual(expectedValue);
                }
            }

            //
            // Match response body against the expected schema.
            //
            if (spec.expected.immediateResponse.body) {
                expect(immediateResponse.data).toMatchSchema(spec.expected.immediateResponse.body);
            }
        }

        //
        // Match the async response against the expected schema.
        //
        if (spec.expected.asyncResponse) {
            const expectedResponse = spec.expected.asyncResponse;
            if (!expectedResponse.exchange) {
                throw new Error(`An exchange is required for async responses on spec '${spec.title}'`);
            }
            const actualAsyncResponsePayload = amqplib.__published__[expectedResponse.exchange];
            if (!actualAsyncResponsePayload) {
                throw new Error(`Expected async response to be published on exchange '${expectedResponse.exchange}'.`);
            }

            if (expectedResponse.body) {
                expect(actualAsyncResponsePayload).toMatchSchema(expectedResponse.body);
            }
        }
    });
});