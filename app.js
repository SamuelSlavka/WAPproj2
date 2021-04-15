const express = require('express');
const app = express();
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const languages = require('./languages');

const port = 8080;


app.use(cors());

app.get('/', function (req, res) {
    res.send("no input");
});

function verifyLanguage(lang) {
    if (!lang) {
        lang = 'en'
    }
    if (!languages.languages.includes(lang)) {
        return {valid: false, lang: lang}
    }
    return {valid: true, lang: lang}
}

app.get('/:val', async function (req, res, next) {
    let verifiedLanguage = verifyLanguage(req.query.lang);

    if(!verifiedLanguage.valid) {
        res.status(400).type('application/json').send({error: 'Wikipedia does not support ' + verifiedLanguage.lang + ' language'})
        return
    }
    var cont = await getContents(req.params.val, verifiedLanguage.lang);
    result = [];
    if (cont) {
        cont.forEach(element => {
            // remove endline chars
            result.push(element.replace(/[\n\r]/g, ' '))
        });
        res.send(result);
    } else {
        res.status(404).type('application/json').send({error: 'Wikipedia does not have an article with this exact name.'})
    }

});


//return contents of article, either first paragraph or itemize
async function getContents(str, language) {
    try {
        const {data} = await axios.get(
            'https://' + language + '.wikipedia.org/wiki/' + str
        );
        const $ = cheerio.load(data);

        $('div.mw-parser-output:empty').remove();
        $('p.mw-empty-elt').remove();

        var content = []
        content.push($('div.mw-parser-output > p:first').text());
        //list of items
        if (content[0].includes('may refer to:')) {
            $('div.mw-parser-output > ul').each((_idx, el) => {
                const item = $(el).text();
                content.push(item);
            });
        }

        return content;
    } catch (error) {
        // no article for topic
        return false;
    }
};


app.listen(port, function () {
    console.log('Example app listening on port ' + port);
})
