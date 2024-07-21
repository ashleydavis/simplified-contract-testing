const crypto = require('crypto');

const __published__ = {};

const __consume__ = {};

const __queue_bindings__ = {};

const mockChannel = {
    async assertExchange() {
    },

    async assertQueue() {
        return {
            queue: crypto.randomBytes(5).toString('hex'),
        };
    },

    async bindQueue(queueName, exchangeName) {
        __queue_bindings__[exchangeName] = queueName;
    },

    async publish(exchange, routingKey, content) {
        __published__[exchange] = JSON.parse(content.toString());
    },

    async consume(queue, handler) {
        __consume__[queue] = handler;
    },

    ack() {
    },
};

const mockConnection = {
    async createChannel() {
        return mockChannel;
    }
};

async function connect() {
    return mockConnection;
}

module.exports = {
    connect,
    __published__,
    __consume__,
    __queue_bindings__,
};