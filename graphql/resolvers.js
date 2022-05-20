const Post = require("../models/Post");
const User = require('../models/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const {UserInputError, AuthenticationError} = require('apollo-server')
const {validateRegisterInput, validateLoginInput} = require('../util/validators')
const checkAuth = require('../util/check-auth')

const generateToken = (user) => {
    return jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username
    }, process.env.SECRET_KEY, {expiresIn: '1h'})
}

const resolvers = {
    Post: {
        likeCount: (parent) => {
            return parent.likes.length
        },
        commentCount: (parent) => {
            return parent.comments.length
        }
    },
    Query: {
        getPosts: async () => {
            try {
                return await Post.find().sort({createdAt: -1})
            } catch (error) {
                throw new Error(error)
            }
        },
        getPost: async (_, {postId}) => {
            try {
                const post = await Post.findById(postId)
                if (!post) {
                    throw new Error('Post not found')
                } else {
                    return post
                }
            } catch (e) {
                throw new Error(e)
            }
        }
    },
    Mutation: {
        register: async (
            parent,
            {registerInput: {username, email, password, confirmPassword}},
            context,
            info
        ) => {
            const {valid, errors} = validateRegisterInput(username, email, password, confirmPassword)
            if (!valid) {
                throw new UserInputError('Errors', {errors})
            }
            const user = await User.findOne({username})

            if (user) {
                return new UserInputError('Username is taken', {errors: {username: 'This username is taken'}})
            }
            password = await bcrypt.hash(password, 12)

            const newUser = new User({
                email, username, password, createdAt: new Date().toISOString()
            })

            const response = await newUser.save()
            const token = generateToken(response)

            return {
                ...response._doc,
                id: response._id,
                token
            }
        },
        login: async (_, {username, password}) => {
            const {errors, valid} = validateLoginInput(username, password)

            if (!valid) throw new UserInputError('Error', {errors})
            const user = await User.findOne({username})
            if (!user) {
                errors.general = 'User not found'
                throw new UserInputError('User not found', {errors})
            }
            const match = await bcrypt.compare(password, user.password)
            if (!match) {
                errors.general = 'Wrong credentials'
                throw new UserInputError('Wrong Credentials', {errors})
            }

            const token = generateToken(user)
            return {
                ...user._doc,
                id: user._id,
                token
            }
        },
        createPost: async (_, {body}, context) => {
            const user = checkAuth(context)
            if (!body) {
                throw new Error('Body must not be empty')
            }
            const newPost = new Post({
                body,
                user: user.id,
                username: user.username,
                createdAt: new Date().toISOString()
            })
            return await newPost.save()
        },
        deletePost: async (_, {postId}, context) => {
            const user = checkAuth(context)
            try {
                const post = await Post.findById(postId)
                if (user.username === post.username) {
                    await post.delete()
                    return post
                } else {
                    throw new AuthenticationError('Error')
                }
            } catch (error) {
                throw new Error(error)
            }
        },
        createComment: async (_, {postId, body}, context) => {
            const {username} = checkAuth(context)
            if (body.trim() === '') {
                throw new UserInputError('Empty comment', {errors: {body: 'Comment body must not be empty'}})
            }

            const post = await Post.findById(postId)
            if (post) {
                post.comments.unshift({
                    body,
                    username,
                    createdAt: new Date().toISOString()
                })
                // await Post.updateOne({_id: postId}, post)
                await post.save()
                return post
            } else {
                throw new UserInputError('Post not found')
            }
        },
        deleteComment: async (_, {postId, commentId}, context) => {
            const {username} = checkAuth(context)

            const post = await Post.findById(postId)
            if (post) {
                const commentIndex = post.comments.findIndex(comment => {
                    return comment.id === commentId
                })
                if (username === post.comments[commentIndex]?.username) {
                    post.comments.splice(commentIndex, 1)
                    await post.save()
                    return post
                } else {
                    throw new AuthenticationError('Action not allowed ')
                }

            } else {
                throw new Error('Post not found')
            }
        },
        likePost: async (_, {postId}, context) => {
            const {username} = checkAuth(context)
            const post = await Post.findById(postId)
            if (post) {
                if (!post.likes?.find(like => like.username === username)) {
                    post.likes?.unshift({
                        createdAt: new Date().toISOString(),
                        username
                    })
                } else {
                    post.likes = post.likes?.filter(like => like.username !== username)
                }
                await post.save()
                return post
            } else {
                throw new Error('Post not found')
            }
        }
    },
    Subscription: {}
}

module.exports = {resolvers}
