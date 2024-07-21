#  mocked-rabbit

An example of simplified contract testing against a REST API and asynchronous messaging that is backed by a MongoDB and RabbitMQ.

The REST API is based on JSON Placeholder: https://jsonplaceholder.typicode.com/

Built on:
- Express.js to implement the REST API.
- MongoDB for the database.
- Amqplib for the connection to RabbitMQ.
- Jest for running the tests and matching expectations.
- Jest is used to mock MongoDB and Amqplib for the automated contract tests.
- Axios for making the HTTP requests.
- Jest-json-schema and Ajv for testing the REST API response against the JSON schema in the test spec.
- Yaml for parsing the test spec.

## Test spec

See the test spec here: [./test/test-spec.yaml](./test/test-spec.yaml).

See the contract testing code here: [./test/contract.test.js](./test/contract.test.js).

## Setup

```bash
git clone git@github.com:ashleydavis/simplified-contract-testing.git
cd simplified-contract-testing/mocked-rabbit
npm install
```

## Run tests

```bash
npm test
```

Note: testing uses mocked versions of MongoDB and Amqplib.

## Run the REST API

```bash
npm start
```

Note: This includes an instant development database.
Note: You must have RabbitMQ installed or running in a container for the REST API to connect to.

