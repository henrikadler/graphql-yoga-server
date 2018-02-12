import fetch from 'node-fetch'
import { GraphQLServer } from 'graphql-yoga'
import {
  makeExecutableSchema,
  makeRemoteExecutableSchema,
  addMockFunctionsToSchema,
  introspectSchema,
  mergeSchemas
} from 'graphql-tools'
import { createHttpLink } from 'apollo-link-http'

const adlerSchema = makeExecutableSchema({
  typeDefs: `
    type Adler {
      id: ID!
      email: String
    }

    type Query {
      adlerById(id: ID!): Adler
    }
  `
})

// Add mock resolvers to our schema!
addMockFunctionsToSchema({ schema: adlerSchema })

// Decorate exiting (external) Imdb type with extra params...
const linkTypeDefs = `
extend type Imdb {
  adler: Adler
}

extend type Adler {
  imdb: Imdb
}
`

async function run () {
  // 1. Create Apollo Link that's connected to the underlying GraphQL API
  const makeCmoreLink = () => createHttpLink({
    uri: `https://graphql.cmore.se/graphql`,
    fetch
  })

  const makeTv4Link = () => createHttpLink({
    uri: `https://tv4-graphql.b17g.net/graphql`,
    fetch
  })

  // 2. Retrieve schema definition of the underlying GraphQL API
  const cmoreSchemaDefinition = await introspectSchema(makeCmoreLink())
  const tv4SchemaDefinition = await introspectSchema(makeTv4Link())

  // 3. Create the executable schema based on schema definition and Apollo Link
  const cmoreExecutableSchema = makeRemoteExecutableSchema({
    schema: cmoreSchemaDefinition,
    link: makeCmoreLink()
  })

  const tv4ExecutableSchema = makeRemoteExecutableSchema({
    schema: tv4SchemaDefinition,
    link: makeTv4Link()
  })

  const mergedResolvers = mergeInfo => ({
    Adler: {
      imdb: {
        fragment: `fragment AdlerFragment on Adler { id }`,
        resolve (parent, args, context, info) {
          // const id = 'tt5617060' // parent.id
          return mergeInfo.delegate(
            'query',
            'imdb',
            {
              id: 'tt5617060'
            },
            context,
            info
          )
        }
      }
    },
    Imdb: {
      adler: {
        fragment: `fragment ImdbFragment on Imdb { id }`,
        resolve (parent, args, context, info) {
          console.log('ADLER2, parent: ', parent)
          return mergeInfo.delegate(
            'query',
            'adlerById',
            {
              id: parent.id
            },
            context,
            info
          )
        }
      }
    }
  })

  const schema = mergeSchemas({
    schemas: [
      adlerSchema,
      cmoreExecutableSchema,
      tv4ExecutableSchema,
      linkTypeDefs
    ],
    resolvers: mergedResolvers
  })

  // 4. Create and start proxy server based on the executable schema
  const server = new GraphQLServer({ schema })
  server.start(() => console.log('Server is running on http://localhost:4444'))
}

run()
