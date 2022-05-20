require('dotenv').config()
const {ApolloServer} = require('apollo-server')
const mongoose = require('mongoose')
const {typeDefs} = require("./graphql/typeDefs");
const {resolvers} = require("./graphql/resolvers");

const PORT = process.env.PORT || 4000

const server = new ApolloServer({typeDefs, resolvers, context: ({req}) => ({req})})
mongoose.connect(process.env.MONGODB)
    .then(() => server.listen({port: PORT}))
    .then(() => console.log('server is running'))
    .catch((err) => console.log(err))