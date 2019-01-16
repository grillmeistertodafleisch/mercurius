'use strict'

const { join } = require('path')
const Static = require('fastify-static')
const { BadRequest } = require('http-errors')
const { formatError, GraphQLError } = require('graphql')

const responseSchema = {
  '2xx': {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        additionalProperties: true
      },
      errors: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                line: { type: 'integer' },
                column: { type: 'integer' }
              }
            }
          },
          path: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }
}

async function defaultErrorHandler (err, request, reply) {
  if (!err.statusCode) {
    throw err
  }

  reply.code(err.statusCode)
  if (err.errors) {
    const errors = err.errors.map(error => {
      return error instanceof GraphQLError ? formatError(error) : { message: error.message }
    })

    return { errors }
  } else {
    return {
      errors: [
        { message: err.message }
      ]
    }
  }
}

module.exports = async function (app, opts) {
  app.setErrorHandler(opts.errorHandler || defaultErrorHandler)

  app.get('/graphql', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          query: {
            type: 'string'
          },
          operationName: {
            type: 'string'
          },
          variables: { // this is a JSON
            type: 'string'
          }
        }
      },
      response: responseSchema
    }
  }, function (request, reply) {
    let {
      query,
      variables,
      operationName
    } = request.query

    if (variables) {
      try {
        variables = JSON.parse(variables)
      } catch (err) {
        request.log.info({ err: err })
        reply.send(new BadRequest(err.message))
        return
      }
    }

    return reply.graphql(query, null, variables, operationName)
  })

  app.post('/graphql', {
    schema: {
      body: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'the GraphQL query'
          },
          operationName: {
            type: 'string'
          },
          variables: {
            type: ['object', 'null'],
            additionalProperties: true
          }
        }
      },
      response: responseSchema
    }
  }, function (request, reply) {
    const {
      query,
      variables,
      operationName
    } = request.body

    return reply.graphql(query, null, variables, operationName)
  })

  if (opts.graphiql) {
    app.register(Static, {
      root: join(__dirname, 'static'),
      wildcard: false
    })

    app.get('/graphiql', (req, reply) => {
      reply.redirect(`${app.basePath}/graphiql.html`)
    })
  }
}
