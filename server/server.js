const express = require('express');
const app = express();
const path = require('path');

const s3 = require("./clients/aws_client.js")
const bodyParser = require('body-parser');
const discogs = require('./clients/discogs_client');



app.use(bodyParser.json());
app.get('', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'))
})

app.get('/test', (req, res) => {
  res.send({ express: "Hello from express" })
})

app.get('/artists', async (req, res) => {
  s3.listArtists((err, data) => {
    if (err) {
      res.send(err)
    }
    else {
      res.send(data)
      res.send(data)
    }
  })

})

function unpackDetails(data, albumName, response) {
  return new Promise((resolve, reject) => {
    response[albumName] = data
    console.log("Editing response object")
    resolve(response)
  })
}

app.get("/artists/:artist/albums", async (req, res) => {
  const artistName = req.params.artist
  let response = {};

  let albums = await s3.listAlbums(artistName)
  const promises = albums.map(async (album) => {
    let result = await discogs.getAlbumId(artistName, album)
    try {
      let masterId = result.data.results[0].id
      let tempRes = await discogs.getAlbumDetails(masterId)
      return [album, tempRes.data]
    } catch (error) {
      return [album, { "msg": error.message }]
    }
  })

  responses = await Promise.all(promises)
  responses.map(data => { response[data[0]] = data[1] })

  res.send(response)
})



app.get("/artists/:artist/albums/:album/songs", (req, res) => {
  let albumPath = `${req.params.artist}/${req.params.album}`
  s3.listSongs(albumPath, (err, data) => {
    if (err) {
      res.send(err)
    }
    else { res.send(data) }
  })
})


app.get("/artists/:artist/albums/:album/songs/:song/play", (req, res) => {
  songPath = `${req.params.artist}/${req.params.album}/${req.params.song}`
  let downloadStream = s3.playMusic(songPath);
  console.log("Request initiated")
  res.set('content-type', 'audio/mp3');
  res.set('accept-ranges', 'bytes');

  downloadStream.on('error', (err) => {
    if (err.code === "NoSuchKey") {
      let code = err.code
      let message = err.message
      console.log({ code, message, key: songPath })
      setTimeout(() => {
        downloadStream.emit('end');
      }, 20);
    }
  });

  downloadStream.on('data', (chunk) => {
    res.write(chunk);
  });

  downloadStream.on('end', () => {
    console.log("Download Complete.")
    res.end();
  });



});



app.listen(5000, function () {
  console.log('makin music on 5000');
});

