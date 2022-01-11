# ts_fetch

```
npm install https://github.com/edrlab/ts_fetch.git
```

## demo

```js

const ts_fetch = require("ts-fetch");
const fs = require('fs');



(async function () {

  const http = new ts_fetch.http();

  const data = await http.get("https://storage.googleapis.com/audiobook_edrlab/navigation/thematic_list.json", {}, async (res) => {

    res.data = await res.response?.json();

    return res;
  });

  console.log(data);
  fs.writeFileSync("/tmp/feed_data.json", JSON.stringify(data));

})()

```
