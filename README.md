# GraphQL schema stiching example

Testing grapql stiching with apollo and graphql-yoga.

Babel and eslint configuration with spread operator support.

## Details
The example combines two graphql endpoints (tv4 play and cmore) with extra custom properties.

* https://tv4-graphql.b17g.net/graphql
* https://graphql.cmore.se/graphql

An exaple query would look like:

```js
{
  adlerById (id: "1") {
    id
    imdb {
      type
      title
      rating
      adler {
        id
        imdb {
          url
        }
      }
    }
  }
}
```

Will return:

```js
{
  "data": {
    "adlerById": {
      "id": "1"
      "imdb": {
        "type": "tvSeries",
        "title": "Farang",
        "rating": 7,
        "adler": {
          "id": "1",
          "imdb": {
            "url": "http://www.imdb.com/title/tt5617060"
          }
        }
      }
    }
  }
}
```

The interesting part is the added adler property added to the already existing imdb type. Also the custom Adler object adds the existing imdb type. 

