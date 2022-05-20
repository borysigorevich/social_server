const jwt = require('jsonwebtoken')
const {AuthenticationError} = require('apollo-server')

module.exports = (context) => {
    const authHeader = context.req.headers.authorization
    if (authHeader) {
        const token = authHeader.split('Bearer ')[1]
        if (token) {
            try {
                return jwt.verify(token, process.env.SECRET_KEY)
            } catch (error) {
                throw new AuthenticationError('Invalid/expire token')
            }
        } else {
            throw new Error('Authentication token must be \'Bearer [token]\'')
        }
    } else {
        throw new Error('Authorization header must be provided')
    }
}
