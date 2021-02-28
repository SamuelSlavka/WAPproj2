const express = require('express');
const app = express();

const axios = require('axios');
const cheerio = require('cheerio');


const path = __dirname + '/views/';
const port = 8080;

app.get('/', function(req, res){
	var key = req.query['api-key'];
	res.send('hello');
});


app.get('/:val', async function(req, res, next){
	var cont = await searchitem(req.params.val);
	result = [];
	cont.forEach(element => {
		result.push(element.replace(/[\n\r]/g,' '))
	});
	
	res.send(result);
});
  

//execute search in wikipedia
async function searchitem(str)
{
	try {
		const { data } = await axios.get(
			'https://en.wikipedia.org/w/index.php?search='+str+'&title=Special:Search&profile=advanced&fulltext=1&advancedSearch-current={}&ns0=1'
		);
		var $ = cheerio.load(data);
		var result = [];
		$('div.mw-parser-output:empty').remove();
		$('p.mw-empty-elt').remove();
		
		if ($('p.mw-search-exists').text() != ''){
			result = await getContents(str);
		}
		else if ($('p.mw-search-nonefound') != ''){
			result.push($('p.mw-search-nonefound').text());    
		}
		else {
			if ($('div.searchdidyoumean') != '')
				result.push($('div.searchdidyoumean').text());   
			else result.push($('p.mw-search-createlink').text());    

			var newterm = $('ul.mw-search-results > li.mw-search-result > div.mw-search-result-heading > a:first').text();
			result.push( await getContents(newterm));   
			result = result.flat(1);
		}	

		return result;
	} catch (error) {
		throw error;
	}
};

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
		

		if (content[0].includes('refer to:')){
			$('div.mw-parser-output > ul').each((_idx, el) => {
				const item = $(el).text();
				content.push(item)
			});
		}
		
		return content;
	} catch (error) {
		throw error;
	}
};


app.listen(port, function () {
  console.log('Example app listening on port 8080!');
})

