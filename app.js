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


app.get('/search', async function (req, res) {
    if (!req.query.search) {
        res.status(400).type('application/json').send({error: "Search query parameter is required"});
        return
    }
    let searchedString = req.query.search;

    axios
        .get(encodeURI("https://en.wikipedia.org/w/api.php?action=opensearch&search=" + searchedString + "&limit=5&namespace=0&format=json"))
        .then(response => {
            if (response.data[1].length === 0) {
                res.status(404).type('application/json').send({error: "No article found with search: " + searchedString});
                return
            }
            let r = {
                "searched_by": response.data[0],
                "best_match_article_name": response.data[1][0],
                "best_match_article_url": decodeURI(response.data[3][0]).split("/").pop(),
                "suggested_articles": response.data[1],
                "suggested_urls": response.data[3].map(x=>decodeURI(x).split("/").pop()),
            };
            res.status(200).type('application/json').send(r)
        })
        .catch(err => {
            res.status(500).type('application/json').send({error: err})
        });
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

        let result = [];
        let first;
        $('#toc > ul > li').each(function (i, elem) {
            let section = {
                index: "",
                name: "",
                subsections: [],
            };
            $(this).find('a').each(function (i, elem) {
                if (i === 0) {
                    first = $(this).text();
                    let [index, ...name] = first.split( " ");
                    name = name.join(' ');
                    section.index = index;
                    section.name = name;
                }
                else {
                    let [index, ...name] = $(this).text().split( " ");
                    name = name.join(' ');
                    let subsection = {
                        index: index,
                        name: name
                    };
                    section.subsections.push(subsection);
                }
            });
            result.push([section]);
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
        $("img").each(function (i, image) {
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
            encodeURI('https://' + language + '.wikipedia.org/wiki/' + str)
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
