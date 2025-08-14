# level-min

💡 A light-weight full-text search library for Node.js, aimed to minimize the workload of developers. Using LevelDB as storage backend.
[Chinese version Readme](https://github.com/ruiyeah/level-min/blob/master/README_zh.md)

[![npm](https://img.shields.io/npm/v/level-min.svg?label=&logo=npm)](https://www.npmjs.com/package/level-min)
[![Node version](https://img.shields.io/node/v/level-min.svg)](https://www.npmjs.com/package/level-min)

- 🧠 **Built-in Text Processing**: Tokenizer, Porter Stemmer and Stopwords filter with multi-language support
- 🔍 **Advanced Search**: TF-IDF algorithm combined with Cosine Similarity for intelligent ranking
- ⚡ **High Performance**: Built-in caching mechanisms and performance monitoring
- 🗄️ **Flexible Indexing**: Highly configurable index-schema for flexible inverted index construction
- 🌍 **Multi-language Support**: Chinese, English, Japanese, French, Italian, Russian, Spanish, Portuguese, etc.
- 💾 **Transaction Support**: ACID-compliant transactions with rollback functionality
- 📊 **Performance Monitoring**: Real-time performance metrics and statistics

This package is provided for developers who would like to deploy their node.js based application on an entry-level server/VPS.

Ease of deployment and light-weight are all the ambitions of this package.

If you require more features for a more complex application, maybe `ElasticSearch` will be a better potential solution.


## Installation
```sh
$ npm install level-min
```
In general, a valid [`node-gyp`](https://github.com/nodejs/node-gyp) installation is needed.

## Quick Start

```js
const Min = require("level-min");

// Initialize level-min instance
const min = new Min();

// Set up the database with address and options
// An absolute path like database address is strongly recommended 
// (if it is relative, the dbAddress = path.join(process.cwd(), InputDbAddress))
await min.initializeDatabase("data", options);

// An example of how to store and index a document.
// Using such a schema, only the title and content in the value object will be indexed.
// So that those useless indexes of the value (i.e. a field of imgUrl) will not be stored.
min.put("Document1",{
    title:"Introduction of level-min",
    content:"This is a long text. Balabala. ",
    imgUrl:"http://just-for-example.url.com/img.jpg"
},{
    keyWeight:0,
    valueWeightCalc:true,
    defaultValueWeight:0,
    valueWeights: { title: 5, content: 1 }
})

min.put("example", "A meaningless string.");

// In practice, the result may be affected since both put() and search are async.
// Consider using Promise.all() or async/await for proper sequencing.
let result = await min.search("Introduction");
```

## API

- <a href="#Min"><code><b>Min()</b> / min.<b>initializeDatabase()</b></code></a>
- <a href="#put"><code>min.<b>put()</b></code></a>
- <a href="#create"><code>min.<b>create()</b></code></a>
- <a href="#update"><code>min.<b>update()</b></code></a>
- <a href="#del"><code>min.<b>del()</b></code></a>
- <a href="#get"><code>min.<b>get()</b></code></a>
- <a href="#search"><code>min.<b>search()</b></code></a>
- <a href="#transaction"><code>min.<b>transaction()</b></code></a>
- <a href="#batch"><code>min.<b>batchCreate()</b></code></a>
- <a href="#performance"><code>min.<b>getPerformanceStats()</b></code></a>
- <a href="#cache"><code>min.<b>clearCache()</b></code></a>
- <a href="#stats"><code>min.<b>getDocCount()</b></code></a>
- <a href="#tokenizer">Setting of tokenizer</a>

<a name="Min"></a>

### `Min()` / `min.initializeDatabase(dbAddress, [options])`
`Min()` creates a new level-min instance without any parameters. Use `min.initializeDatabase(dbAddress, [options])` to initialize the database connection.

Usage:
```js
const min = new Min();
await min.initializeDatabase("data", options);
```

#### options(Same as the content at [leveldown#db.open](https://github.com/Level/leveldown#leveldown_open))

The optional `options` argument may contain:

- `createIfMissing` (boolean, default: `true`): If `true`, will initialize an empty database at the specified location if one doesn't already exist. If `false` and a database doesn't exist you will receive an error in your `open()` callback and your database won't open.

- `errorIfExists` (boolean, default: `false`): If `true`, you will receive an error in your `open()` callback if the database exists at the specified location.

- `compression` (boolean, default: `true`): If `true`, all _compressible_ data will be run through the Snappy compression algorithm before being stored. Snappy is very fast and shouldn't gain much speed by disabling so leave this on unless you have good reason to turn it off.

- `cacheSize` (number, default: `8 * 1024 * 1024` = 8MB): The size (in bytes) of the in-memory [LRU](http://en.wikipedia.org/wiki/Cache_algorithms#Least_Recently_Used) cache with frequently used uncompressed block contents.

**Advanced options**

The following options are for advanced performance tuning. Modify them only if you can prove actual benefit for your particular application.

- `writeBufferSize` (number, default: `4 * 1024 * 1024` = 4MB): The maximum size (in bytes) of the log (in memory and stored in the .log file on disk). Beyond this size, LevelDB will convert the log data to the first level of sorted table files. From the LevelDB documentation:

> Larger values increase performance, especially during bulk loads. Up to two write buffers may be held in memory at the same time, so you may wish to adjust this parameter to control memory usage. Also, a larger write buffer will result in a longer recovery time the next time the database is opened.

- `blockSize` (number, default `4096` = 4K): The _approximate_ size of the blocks that make up the table files. The size related to uncompressed data (hence "approximate"). Blocks are indexed in the table file and entry-lookups involve reading an entire block and parsing to discover the required entry.

- `maxOpenFiles` (number, default: `1000`): The maximum number of files that LevelDB is allowed to have open at a time. If your data store is likely to have a large working set, you may increase this value to prevent file descriptor churn. To calculate the number of files required for your working set, divide your total data by `'maxFileSize'`.

- `blockRestartInterval` (number, default: `16`): The number of entries before restarting the "delta encoding" of keys within blocks. Each "restart" point stores the full key for the entry, between restarts, the common prefix of the keys for those entries is omitted. Restarts are similar to the concept of keyframes in video encoding and are used to minimise the amount of space required to store keys. This is particularly helpful when using deep namespacing / prefixing in your keys.

- `maxFileSize` (number, default: `2* 1024 * 1024` = 2MB): The maximum amount of bytes to write to a file before switching to a new one. From the LevelDB documentation:

> ... if your filesystem is more efficient with larger files, you could consider increasing the value. The downside will be longer compactions and hence longer latency/performance hiccups. Another reason to increase this parameter might be when you are initially populating a large database.

### Notes:

Both `put()` and `del()` have used the [`db.batch()`](https://github.com/Level/leveldown#leveldown_batch) of level to keep the Atomicity inside the db's transactions. Hence, skip those functions offered by `level-min` and operate the `leveldb` directly can be dangerous.

<a name="put"></a>

### `min.put(key,value,[options,])`

<code>put()</code> is an instance method on an existing database object, used to store new entries, or overwrite existing entries in the LevelDB store. At the same time, the indexes based on the input are also generated. A promise is returned.

The `key` should be a string. The value should preferably be a `String`, `Array`, or `Object`. Other object types may result in unexpected errors. Keys may not be `null` or `undefined`, and objects converted with `toString()` should not result in an empty string. Values may not be `null` or `undefined`.

The optional `options` argument may contain:

- `keyWeight` (Number, default: `1`): If the value of given `keyWeight` is less than or equal to zero(<=0), the tokens inside the input key will not be indexed.
- `valueWeightCalc` (boolean, default: `false`): If `false`, the tokens inside the value will not be counted. Switch it to `true` if it is needed.
- `defaultValueWeight` (Number, default: `1`): If the value of given `valueWeightCalc` is `true`, its value will be calculated as the default weights of tokens inside value.
- `valueWeights` (object, default: `{}`): The weights for specific keys/indices when the value is an Array/Object. For example, if the value is an object `{a: text, b: text, ...}` and `valueWeights` is `{a: 3}`, the tokens inside field `a` will be calculated with a token-frequency of 3, while other fields' token-frequency will follow the `defaultValueWeight`.

<a name="del"></a>

### `min.del(key)`

Deletes the record associated with the key from the database. If there are any associated indexes that were generated with the document, they will be removed as well. Returns a Promise.


<a name="get"></a>

### `min.get(key)`


`get()` is the primary method for fetching data from the store. The `key` should be a string. If the key doesn't exist in the store, the promise will be rejected. A not-found error object will be of type `'NotFoundError'`, so you can check `err.type == 'NotFoundError'` or perform a truthy test on the property `err.notFound`.

```js
min.get("example").then(info=>{
    ...
}).catch(e=>{
    if (e.type === "NotFoundError") {
    // There is no such key in the database
}
})
```


<a name="search"></a>

### `min.search(content, [options])`
The `search()` function tokenizes the input query and then searches for these tokens in the database. If multiple results are returned, their scores are calculated using the <b>TF-IDF</b> algorithm and <b>Cosine Similarity</b>. The top-k results, sorted by their scores in descending order, are returned via a Promise.

An example for the search:
```js
const options = {
    limit: 10, // Return only the top 10 results
    cosineSimilarity: true // Combine TF-IDF with cosine similarity (false: TF-IDF only, true: combined)
};

min.search("Shakespeare").then(results => {
    // Results are returned in order
}).catch(error => {
    // Handle exception
});
```


<a name="tokenizer"></a>

### What if you want to use some customized text processing components rather than the integrated one?

A serious of APIs are offered to let the developers customize there own Tokenizer, Stopwords and Stemmer.

```js
min.tokenizer.setCustomStopwords(["avi", "1080"]);
```
This function, `min.tokenizer.setCustomStopwords()`, accepts an array of stopwords that will act as token filters in subsequent processing steps.


```js
min.tokenizer.setCustomTokenizer(tokenizer);
```
`min.tokenizer.setCustomTokenizer()` accepts an object with a `tokenize()` function that can split the input sentence into an array of tokens. If the object doesn't contain this function, an error will be logged to the console.


```js
min.tokenizer.setCustomStemmer(stemmer);
```
`min.tokenizer.setCustomStemmer()` accepts an object with a `stem()` function that accepts a token and returns a processed string. If the object doesn't contain this function, an error will be logged to the console.

If developers want to switch the tokenizer or stemmer back to the integrated one, `min.tokenizer.configTokenizer()` can be used.

An example:
```js
min.tokenizer.configTokenizer({
    tokenizer: true,
    stemmer: true,
    stopword: true,
    customTokenizer: false,
    customStopword: false,
    customStemmer: false
});
```

When the stemmer and stopword options switch to false, the Text Processing Procedure will not contain these procedures anymore.

<b>Warning:</b> the modification of the attributes in the above configuration can result in an unexpected and serious consequences. So I strongly advice that the option `tokenizer` should always be `true`.

<a name="transaction"></a>

### `min.transaction()`

Creates a new transaction object that allows you to perform multiple database operations atomically. Transactions support put, del, get operations and can be committed or rolled back. Returns a Promise that resolves to a transaction object.

#### Transaction Methods:

- `transaction.put(key, value, [options])`: Store a key-value pair within the transaction. Same options as `min.put()`.
- `transaction.del(key)`: Delete a key-value pair within the transaction.
- `transaction.get(key)`: Get a value by key within the transaction. Returns the value if found in the transaction or database.
- `transaction.commit()`: Commit all operations in the transaction to the database. Returns a Promise.
- `transaction.rollback()`: Rollback all operations in the transaction, restoring the database to its original state. Returns a Promise.

#### Example:
```js
// Create a transaction
const transaction = await min.transaction();

try {
    // Perform operations within the transaction
    await transaction.put('key1', 'value1');
    await transaction.put('key2', 'value2');
    await transaction.del('oldKey');
    
    // Get value within transaction
    const value = await transaction.get('key1');
    console.log(value); // 'value1'
    
    // Commit the transaction
    await transaction.commit();
    console.log('Transaction committed successfully');
} catch (error) {
    // Rollback on error
    await transaction.rollback();
    console.log('Transaction rolled back due to error:', error.message);
}
```

#### Transaction Features:

- **Atomicity**: All operations within a transaction are executed atomically. Either all operations succeed, or none are applied.
- **Consistency**: The database remains in a consistent state. If a transaction fails, all changes are rolled back.
- **Isolation**: Operations within a transaction are isolated from other concurrent operations.
- **Data Recovery**: When rolling back, the database is restored to its original state before the transaction began.
- **Error Handling**: If any operation within a transaction fails, the entire transaction can be rolled back automatically.

#### Important Notes:

- After a transaction is committed or rolled back, it cannot be used for further operations.
- Transactions ensure data integrity by maintaining original data state and restoring it during rollback.
- All transaction operations are asynchronous and should be properly handled with async/await or Promises.

<a name="create"></a>

### `min.create(key,value,[options,])`

<code>create()</code> is used to store new entries in the LevelDB store. Unlike `put()`, this method will throw an error if the document already exists. This method also generates indexes based on the input and uses actual term frequency calculation for TF-IDF. Returns a Promise.

```js
try {
    await min.create("doc1", {
        title: "New Document",
        content: "This is a new document with actual term frequency calculation"
    });
    console.log("Document created successfully");
} catch (error) {
    if (error.message === "Document already exists") {
        console.log("Document already exists");
    }
}
```

<a name="update"></a>

### `min.update(key,value,[options,])`

<code>update()</code> is used to update existing entries in the LevelDB store. This method will throw an error if the document does not exist. It updates both the document content and the associated indexes with actual term frequency calculation. Returns a Promise.

```js
try {
    await min.update("doc1", {
        title: "Updated Document",
        content: "This is the updated content with improved TF-IDF calculation"
    });
    console.log("Document updated successfully");
} catch (error) {
    if (error.message.includes("does not exist")) {
        console.log("Document does not exist");
    }
}
```

<a name="batch"></a>

### `min.batchCreate(docs)`

<code>batchCreate()</code> allows you to create multiple documents in a single operation. This method accepts an array of document objects and returns a Promise that resolves to an array of document IDs.

```js
const docs = [
    { key: "doc1", value: { title: "Document 1", content: "Content 1" } },
    { key: "doc2", value: { title: "Document 2", content: "Content 2" } },
    { key: "doc3", value: { title: "Document 3", content: "Content 3" } }
];

const results = await min.batchCreate(docs);
console.log("Created documents:", results);
```

<a name="performance"></a>

### `min.getPerformanceStats()`

<code>getPerformanceStats()</code> returns performance metrics and statistics about the database operations, including search times, cache hits/misses, and other performance indicators.

```js
const stats = await min.getPerformanceStats();
console.log("Performance stats:", stats);
// Example output:
// {
//   search: { count: 100, avgTime: 12.5 },
//   cache_hit: { count: 80 },
//   cache_miss: { count: 20 },
//   put: { count: 50, avgTime: 8.3 }
// }
```

<a name="cache"></a>

### `min.clearCache(type)`

<code>clearCache()</code> clears the internal caches. The `type` parameter can be 'search', 'index', or 'all' (default). This is useful for memory management or when you need to ensure fresh data.

```js
// Clear search cache only
await min.clearCache('search');

// Clear index cache only
await min.clearCache('index');

// Clear all caches
await min.clearCache('all');
```

<a name="stats"></a>

### `min.getDocCount()`

<code>getDocCount()</code> returns the total number of documents currently stored in the database.

```js
const count = await min.getDocCount();
console.log("Total documents:", count);
```

### Additional Utility Methods

#### `min.getIndexStats()`
Returns statistics about the inverted index, including token frequencies and document distributions.

#### `min.optimizeIndex()`
Optimizes the inverted index for better performance. This operation may take some time on large databases.

#### `min.dumpAllDocuments()`
Dumps all documents to the console for debugging purposes. Use with caution on large databases.

#### `min.close()`
Properly closes the database connection and releases all resources.

## <span style="vertical-align:baseline !important;">✨</span> Develop Plan

- [x] **Enhanced TF-IDF Algorithm**: Actual term frequency calculation for improved search accuracy
- [x] **Integrated Text Processing**: Tokenizer, Porter Stemmer and Stopwords filter with multi-language support
- [x] **Direct LevelDB Operations**: Low-level database access with atomic operations
- [x] **Custom Text Processing**: Support for custom tokenizers, stemmers, and stopwords
- [x] **Cosine Similarity**: Combined with TF-IDF for intelligent result ranking
- [x] **Transaction Support**: ACID-compliant transactions with rollback functionality
- [x] **Performance Monitoring**: Real-time performance metrics and statistics
- [x] **Caching System**: Built-in search and index caching for improved performance
- [x] **Batch Operations**: Efficient bulk document creation and updates
- [x] **Document Management**: Separate create and update operations with proper error handling

<a name="textProcessProcedure"></a>

## About the Text Processing Procedure

The built-in text processing procedures in `level-min` including Tokenizer, Porter Stemmer and Stopwords filter that are offered by various npm libraries.

### Key Improvements in Version 3.0.0

#### Multi-Language Support

As a result of the multi-language supporting, there are many versions of those integrated tokenizers, stemmers and stopwords filter since they are from different packages.

In practice, which lib will be used in a specific input is more likely to depend on the language-detect packages. Hence, the indexes generated by the text processing procedure may be slightly different than what is being indexed.

To solve this issue, a configurable language preference is provided (as above).

### Performance Optimizations

#### Caching System
- **Search Cache**: Caches search results to improve performance for repeated queries
- **Index Cache**: Caches inverted index data to reduce database access
- **Configurable Size**: Cache sizes can be adjusted based on memory constraints

#### Performance Monitoring
- **Real-time Metrics**: Track search times, cache hit/miss ratios, and operation counts
- **Statistics API**: Access detailed performance data for optimization
- **Debugging Support**: Built-in tools for performance analysis and debugging

### Advanced Features

#### Atomic Operations
- **Document-level Operations**: All document operations are atomic
- **Transaction Support**: Multi-operation transactions with rollback capability
- **Consistency Guarantees**: Data integrity is maintained across all operations

#### Flexible Indexing
- **Customizable Weights**: Configure weights for different document fields
- **Field-specific Indexing**: Control which fields are indexed and their importance
- **Dynamic Schema**: Index schema can be modified without rebuilding the entire index









