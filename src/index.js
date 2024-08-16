// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers } = require("ethers");
const Sentiment = require('sentiment');
const sentimentAnalyzer = new Sentiment();

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

function hextoString(hexx) {
 return ethers.toUtf8String(hexx);
}

function stringtoHex(payload) {
 return ethers.hexlify(ethers.toUtf8Bytes(payload));
}


let positiveCount = 0; // Count of positive sentences
let negativeCount = 0; // Count of negative sentences
let neutralCount = 0; // Count of neutral sentences
let recentSentiments = [];  // Stores the most recent sentiment scores
let topPositiveSentences = [];  // Stores the top positive sentences
let topNegativeSentences = [];  // Stores the top negative sentences
let totalScore = 0;  // Accumulates sentiment scores for averaging
let totalSentences = 0;  // Counts the total number of sentences processed

async function handle_advance(data) {
  const payload = data["payload"];

  let sentence = hextoString(payload);
  if (!isNaN(sentence)) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: stringtoHex("Input is not a valid sentence") }),
    });
    return "reject";
  }


  const result = sentimentAnalyzer.analyze(sentence);
  const sentimentScore = result.score;
  let sentiment;

  if (sentimentScore > 0) {
    positiveCount += 1;
    sentiment = "Positive";
    // Store top positive sentences
    topPositiveSentences.push({ sentence, score: sentimentScore });
    topPositiveSentences.sort((a, b) => b.score - a.score);
    if (topPositiveSentences.length > 5) topPositiveSentences.pop();
  } else if (sentimentScore < 0) {
    negativeCount += 1;
    sentiment = "Negative";
    // Store top negative sentences
    topNegativeSentences.push({ sentence, score: sentimentScore });
    topNegativeSentences.sort((a, b) => a.score - b.score);
    if (topNegativeSentences.length > 5) topNegativeSentences.pop();
  } else {
    neutralCount += 1;
    sentiment = "Neutral";
  }

  // Update recent sentiments
  recentSentiments.push({ sentence, sentiment });
  if (recentSentiments.length > 10) recentSentiments.shift();

  // Update average sentiment score
  totalScore += sentimentScore;
  totalSentences += 1;

  const notice_req = await fetch(rollup_server + "/notice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: stringtoHex(`Sentiment: ${sentiment}`) }),
  });

  console.log("Received advance request data " + JSON.stringify(data));
  return "accept";
}

async function handle_inspect(data) {
  const payload = data["payload"];

  const route = hextoString(payload);
  let responseObject = {};
  if (route === "users") {
    responseObject = JSON.stringify({ users });
  } else if (route === "positiveCount") {
    responseObject = JSON.stringify({ positiveCount });
  } else if (route === "negativeCount") {
    responseObject = JSON.stringify({ negativeCount });
  } else if (route === "neutralCount") {
    responseObject = JSON.stringify({ neutralCount });
  } else if (route === "recentSentiments") {
    responseObject = JSON.stringify({ recentSentiments });
  } else if (route === "topPositiveSentences") {
    responseObject = JSON.stringify({ topPositiveSentences });
  } else if (route === "topNegativeSentences") {
    responseObject = JSON.stringify({ topNegativeSentences });
  } else if (route === "averageSentimentScore") {
    const averageScore = totalSentences > 0 ? totalScore / totalSentences : 0;
    responseObject = JSON.stringify({ averageSentimentScore: averageScore });
  } else {
    responseObject = "Route not implemented";
  }

  const report_req = await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: stringtoHex(responseObject) }),
  });

  console.log("Received inspect request data " + JSON.stringify(data));
  return "accept";
}


var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();
