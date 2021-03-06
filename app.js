const express = require('express');
const app = express();
const cors = require('cors')
const axios = require('axios');
const cheerio = require('cheerio');

const port = 8080;

app.use(cors())

app.get('/', function(req, res){
	res.send("no input");
});

app.get('/:val', async function(req, res, next){
	var cont = await getContents(req.params.val);
	result = [];
	cont.forEach(element => {
		// remove endline chars
		result.push(element.replace(/[\n\r]/g,' '))
	});
	
	res.send(result);
});
  

//return contents of article, either first paragraph or itemize
async function getContents(str) 
{
	try {		
		const { data } = await axios.get(
			'https://en.wikipedia.org/wiki/'+str
		);
		const $ = cheerio.load(data);
		
		$('div.mw-parser-output:empty').remove();
		$('p.mw-empty-elt').remove();
		
		var content = []
		content.push($('div.mw-parser-output > p:first').text());	
		//list of items
		if (content[0].includes('may refer to:')){
			$('div.mw-parser-output > ul').each((_idx, el) => {
				const item = $(el).text();
				content.push(item);
			});
		}
		
		return content;
	} catch (error) {	
		// no article for topic
		return ['Wikipedia does not have an article with this exact name.'];
	}
};


app.listen(port, function () {
  console.log('Example app listening on port '+ port);
})
