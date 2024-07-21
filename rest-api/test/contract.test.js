const axios = require("axios");
const yaml = require("yaml");
const fs = require("fs");
const { resolveRefs } = require("./lib/resolver");

const { matchers } = require("jest-json-schema");
expect.extend(matchers);

const baseURL = `https://jsonplaceholder.typicode.com`;

describe("Contract tests", () => {

    const testSpec = resolveRefs(yaml.parse(fs.readFileSync(`${__dirname}/test-spec.yaml`, 'utf-8')));

    test.each(testSpec.specs)(`$title`, async spec => { // Generates a test for each test spec in the contract.

        //
        // Makes the HTTP request.
        //
        const response = await axios({
            method: spec.method,
            url: spec.url,
            baseURL,
            data: spec.body,
            validateStatus: () => true, // All status codes are ok.
        });

        //
        // Match headers.
        //
        if (spec.expected.headers) {
            for ([headerName, expectedValue] of Object.entries(spec.expected.headers)) {
                const actualValue = response.headers[headerName.toLowerCase()]
                expect(actualValue).toEqual(expectedValue);
            }
        }

        //
        // Match response body against the expected schema.
        //
        if (spec.expected.body) {
            expect(response.data).toMatchSchema(spec.expected.body);
        }
    });
});