const express = require('express');
const app = express();
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const languages = require('./languages');

const port = 8080;


app.use(cors());

function verifyLanguage(lang) {
    if (!lang) {
        lang = 'en'
    }
    if (!languages.languages.includes(lang)) {
        return {valid: false, lang: lang}
    }
    return {valid: true, lang: lang}
}

app.get('/', function (req, res) {
    res.status(404).type('application/json').send({error: "method not found"});
});


app.get('/articles/:val', async function (req, res, next) {
    let verifiedLanguage = verifyLanguage(req.query.lang);

    if (!verifiedLanguage.valid) {
        res.status(400).type('application/json').send({error: 'Wikipedia does not support ' + verifiedLanguage.lang + ' language'});
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

app.get('/articles/:val/contents', async function (req, res, next) {
    let article = req.params.val;
    let verifiedLanguage = verifyLanguage(req.query.lang);

    if (!verifiedLanguage.valid) {
        res.status(400).type('application/json').send({error: 'Wikipedia does not support ' + verifiedLanguage.lang + ' language'});
        return
    }    
    try {
        let page_url = 'https://' + verifiedLanguage.lang + '.wikipedia.org/wiki/' + article;
        const {data} = await axios.get(page_url);
        const $ = cheerio.load(data);

        var content = []
        var result = []
        var first
        $('#toc > ul > li').each(function(i,elem) {
            var subcontents = []
            $(this).find('a').each(function(i,elem){
                if(i==0) first = $(this).text(); 
                else subcontents.push($(this).text());
            });
            if(subcontents.length == 0)
                result.push([first]);
            else
                result.push([first,subcontents]);

        });
        // remove endline chars

        res.status(200).type('application/json').send({contents: result})
    } catch (error) {
        console.log(error);
        res.status(404).type('application/json').send({error: 'Wikipedia does not have an article with this exact name.'})
    }
});

app.get('/articles/:val/images', async function (req, res, next) {
    let article = req.params.val;
    let verifiedLanguage = verifyLanguage(req.query.lang);

    if (!verifiedLanguage.valid) {
        res.status(400).type('application/json').send({error: 'Wikipedia does not support ' + verifiedLanguage.lang + ' language'});
        return
    }
    try {
        let page_url = 'https://' + verifiedLanguage.lang + '.wikipedia.org/wiki/' + article;
        const {data} = await axios.get(page_url);
        const $ = cheerio.load(data);
        var results = [];
        $("img").each(function(i, image) {
            results.push(url.resolve(page_url, $(image).attr('src')));
        });
        let image = $('.infobox').find('img').attr('src');
        if (!!image) {
            image = url.resolve(page_url, image)
        } else {
            image = null;
        }

        res.status(200).type('application/json').send({image: image, images: results})
    } catch (error) {
        console.log(error);
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
