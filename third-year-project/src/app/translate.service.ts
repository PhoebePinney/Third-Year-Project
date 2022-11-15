import { Injectable } from '@angular/core';
import {lemmatizer} from "lemmatizer";

@Injectable({
  providedIn: 'root'
})
export class TranslateService {
  posTagger = require( 'wink-pos-tagger' );
  pluralize = require('pluralize');
  contractions = require('expand-contractions');
  tagger = this.posTagger();
  stopWords = this.getSW();
  months = this.getMonths();
  temporalWords = this.getTemporalWords();
  orderBSL = this.getBSLOrder();

  constructor() { }

  translate(listOfWords: string[], availableWords: string[]) {
    var out: string[] = []; // temp
    var s = '';
    for (let w in listOfWords){
      if (listOfWords[w] != 'I'){ // retain I as a possesive pronoun
        listOfWords[w] = listOfWords[w].toLowerCase(); // set to lowercase
      }
      else{
        listOfWords[w]='I';
      }
      if (this.months.includes(listOfWords[w])){
        listOfWords[w] = listOfWords[w].substring(0, 3);
      }
      //listOfWords[w] = this.pluralize.singular(listOfWords[w])
      if (!this.stopWords.includes(listOfWords[w])){ // remove stopwords
        s = s + listOfWords[w] + ' ';
      }
    }
    listOfWords = this.getOrder(s.split(' '));
    for (let w in listOfWords){
      if (availableWords.includes(listOfWords[w])){ // if available, push whole word
        out.push(listOfWords[w]);
      }
      else if (availableWords.includes(lemmatizer(listOfWords[w]))){
        out.push(lemmatizer(listOfWords[w]));
      }
      else{ // else split into letters and push letters
        const splitWord = listOfWords[w].split('');
        for (const l in splitWord){
          out.push(splitWord[l]);
        }
      }
    }
    return out;
  }

  getOrder(wordList: string[]){
    wordList.pop();
    wordList = this.checkForBigrams(wordList);
    var wordListString = "";
    for (let o in wordList){
      wordListString = wordListString + wordList[o] + ' ';
    }
    var taggedSentence = this.tagger.tagSentence(wordListString);
    var positions = [];
    for (let word in wordList){
      var thisPOS: any = '';
      for (let t in taggedSentence){
        if ((taggedSentence[t].value)==wordList[word]){
          thisPOS = taggedSentence[t].pos;
        }
      }
      if (wordList[word]=='howmuch'){
        positions.push([wordList[word], -1, 'WRB'])
      }
      else if (wordList[word]=='like'){
        positions.push([wordList[word], -1, 'VB'])
      }
      else if (this.temporalWords.includes(wordList[word])){
        positions.push([wordList[word], -1, 'T'])
      }
      else{
        positions.push([wordList[word], -1, thisPOS])
      }
    }
    return (this.assignPositions(wordList, wordListString, positions));
  }

  checkForBigrams(wordList: string[]){
    var bigrams = this.getBigrams(wordList);
    var BTS = this.getBigramsToSigns();
    wordList = [];
    var skip = false;
    for (var b in bigrams){
      if (!skip){
        var notBoth=false;
        for (var bts in BTS){
          if (bigrams[b][0]==BTS[bts][0] && bigrams[b][1]==BTS[bts][1]){
            wordList.push(bts)
            skip=true;
            notBoth=true;
          }
        }
        if (notBoth==false){
          wordList.push(bigrams[b][0])
        }
      }
      else{
        skip=false;
      }
    }
    wordList.pop();
    return wordList;
  }

  assignPositions(wordList: string[], wordListString: string, positions: any[][]){
    var SCs = []; // subordinating conjunctions
    var splitUp: any[][] = [[]];
    var allOrdered: any[] = [];
    var c = 0;
    for (let p in positions){
      if (positions[p][2]=='IN'){
        SCs.push(positions[p][0]);
        c +=1;
        splitUp.push([]);
      }
      else{
        splitUp[c].push(positions[p][0])
      }
    }
    var next = 0;
    for (let part in splitUp){
      var thesePositions = [];
      for (let p in splitUp[part]){
          thesePositions.push(positions[next])
          next +=1;
      }
      next +=1;
      var availablePositions = [...Array(splitUp[part].length).keys()];
      for (let tag in this.orderBSL){
        for (let each in thesePositions){
          if (thesePositions[each][2]==this.orderBSL[tag]){
            thesePositions[each][1]=availablePositions[0];
            availablePositions.shift();
          }
        }
      }
      allOrdered = allOrdered.concat(this.orderFromPositions(thesePositions));
      if (SCs.length>0){
        allOrdered.push(SCs[0]);
        SCs.shift();
      }
    }
    return allOrdered;
  }

  orderFromPositions(positions: any[][]){
    var ordered = [];
    var order = [...Array(positions.length).keys()];
    for (var o in order){
      for (let www in positions){
        if (positions[www][1]==order[o]){
          ordered.push(positions[www][0]);
        }
      }
    }
    return ordered;
  }

  getBSLOrder(){
    var order = ['UH', // interjections
    'T', // temporal words
    'JJ', 'JJR', 'JJS', 'CD', 'PDT', 'DT', // adjectives, numbers, determiners
    'NNP', 'NNS', 'NN', 'NNPS', // nouns
    'FW', // foreign words
    'VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ', // verbs
    'RB', 'RBR', 'RBS', 'EX', 'MD', //adverbs, ex there, modals
    'PRP', 'PRP$', // pronouns
    'WDT', 'WP', 'wP$', 'WRB' //question words
    ];
    return order;

  }

  getBigrams(wordList: string[]){
    var bigrams = [];
    for (let i = 0; i <= (wordList.length); i++){
      bigrams.push([wordList[i],wordList[i+1]])
    }
    return bigrams;
  }

  getBigramsToSigns(){
    var BTS: { [sign: string] : string[]; } = {};
    BTS['nameme'] = ['my', 'name'];
    BTS['dontknow'] = ['not', 'know'];
    BTS['dontlike'] = ['not', 'like'];
    BTS['howmuch'] = ['how', 'much'];
    BTS['thankyou'] = ['thank', 'you'];
    BTS['cant']  = ['can', 'not'];
    return BTS;
  }

  getSW(){
    const SW = ['I','so','to','be', 'the', 'away', 'it', 'do', 'did', 'a', 'an', 'in', 'some', 'is', 'are', 'him', 'her', 'they', 'am', 'and', 'for', 'nor', 'but', 'or', 'yet', 'him', 'her', 'his', 'hers'];
    return SW;
  }

  getTemporalWords(){
    const t = ['yesterday', 'tomorrow', 'now', 'today'];
    return t;
  }

  getMonths(){
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    return months;
  }


}
