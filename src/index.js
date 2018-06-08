import fetch from 'node-fetch'
import { GraphQLServer } from 'graphql-yoga'
import { createHttpLink } from 'apollo-link-http'
import { setContext } from 'apollo-link-context'
import {
  makeExecutableSchema,
  transformSchema,
  RenameRootFields,
  RenameTypes,
  FilterRootFields,
  FilterTypes,
  makeRemoteExecutableSchema,
  addMockFunctionsToSchema,
  introspectSchema,
  mergeSchemas
} from 'graphql-tools'
import { create } from 'domain';

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
  location: GL_Locdata
}
`
const CMORE_GRAPHQL_URL = 'https://graphql.cmore.se/graphql'
const GEO_LOCATION_GRAPHQL_URL = 'https://api.graphloc.com/graphql'

async function run () {

  // 1. Create Apollo Link that's connected to the underlying GraphQL API
  const cmoreLink = createHttpLink({
    uri: CMORE_GRAPHQL_URL,
    fetch
  })

  const geoLocationLink = createHttpLink({
    uri: GEO_LOCATION_GRAPHQL_URL,
    fetch
  })

  // Add country query parameter to request...
  const setCountryLink = setContext((request, { graphqlContext }) => ({
    //uri: `${CMORE_GRAPHQL_URL}?country=${graphqlContext.country}`
    uri: `${CMORE_GRAPHQL_URL}?country=se`
  }))

  // 2. Retrieve schema definition of the underlying GraphQL API
  const cmoreSchemaDefinition = await introspectSchema(cmoreLink)
  const geolocationSchemaDefinition = await introspectSchema(geoLocationLink)

  // 3. Create the executable schema based on schema definition and Apollo Link
  const cmoreExecutableSchema = makeRemoteExecutableSchema({
    schema: cmoreSchemaDefinition,
    link: cmoreLink //setCountryLink.concat(cmoreLink)
  })

  const geoLocationExecutableSchema = makeRemoteExecutableSchema({
    schema: geolocationSchemaDefinition,
    link: geoLocationLink
  })

  // 4. Optinally do tranformations...
  const transformedGeoLocationExecutableSchema = transformSchema(geoLocationExecutableSchema, [
    //new FilterRootFields((operation, fieldName, field) => fieldName === 'getLocation'),
    //new FilterTypes((type) => true),
    new RenameRootFields((operation, name, field) => `GL_${name}`),
    new RenameTypes((name) => `GL_${name.charAt(0).toUpperCase() + name.slice(1)}`)
  ])

  // 5. Create stitched resolvers... 
  const mergedResolvers = {
    Adler: {
      imdb: {
        fragment: `fragment AdlerFragment on Adler { id }`,
        resolve (parent, args, context, info) {
          return info.mergeInfo.delegateToSchema({
            schema: cmoreExecutableSchema,
            operation: 'query',
            fieldName: 'imdb',
            args: {
              id: 'tt5617060'
            },
            context,
            info
          })
        }
      },
      location: {
        resolve (parent, args, context, info) {
          return info.mergeInfo.delegateToSchema({
            schema: transformedGeoLocationExecutableSchema,
            operation: 'query',
            fieldName: 'GL_getLocation',
            args: {
              ip: '172.217.20.46'
            },
            context,
            info,
            //transforms: transformedGeoLocationExecutableSchema.transforms,
          })
        }
      }
    },
    Imdb: {
      adler: {
        fragment: `fragment ImdbFragment on Imdb { id }`,
        resolve (parent, args, context, info) {
          return info.mergeInfo.delegateToSchema({
            schema: adlerSchema,
            operation: 'query',
            fieldName: 'adlerById',
            args: {
              id: parent.id
            },
            context,
            info
          })
        }
      }
    }
  }

  // 6. Merge all schemas and resolvers...
  const schema = mergeSchemas({
    schemas: [
      adlerSchema,
      cmoreExecutableSchema,
      //geoLocationExecutableSchema,
      transformedGeoLocationExecutableSchema,
      linkTypeDefs
    ],
    resolvers: mergedResolvers
  })

  // 7. Create based on the executable schema...
  const server = new GraphQLServer({ 
    schema,
    context: ({ request }) => ({ request, test: 'adler' })
  })

  // 8. Start the server...
  const port = 5555
  server.start({port}, () => {
    console.log(`Server is running on http://localhost:${port}`)
  })
}

run()
