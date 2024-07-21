# rest-api

An example of simplified contract testing against the JSON Placeholder REST API: https://jsonplaceholder.typicode.com/

Built on:
- Jest for running the tests and matching expectations.
- Axios for making the HTTP requests.
- Jest-json-schema and Ajv for testing the REST API response against the JSON schema in the test spec.
- Yaml for parsing the test spec.

## Test spec

See the test spec here: [./test/test-spec.yaml](./test/test-spec.yaml).

See the contract testing code here: [./test/contract.test.js](./test/contract.test.js).

## Setup

```bash
git clone git@github.com:ashleydavis/simplified-contract-testing.git
cd simplified-contract-testing/rest-api
npm install
```

## Run tests

```bash
npm test
```

