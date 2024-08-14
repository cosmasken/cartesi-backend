// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

function hextoString(hexx) {
 return ethers.toUtf8String(hexx);
}

function stringtoHex(payload) {
 return ethers.hexlify(ethers.toUtf8Bytes(payload));
}

function isNumeric(num) {
  return !isNaN(num);
}


let users = [];
let toUpperTotal = 0;

async function handle_advance(data) {
  const metadata = data["metadata"];
  const sender = data["sender"];
  const payload = data["payload"];

  let sentence = hextoString(payload);
  if (isNumeric(sentence)) {
  //TODO: add error input
    return "reject";
  }

  users.push(sender);
  toUpperTotal += 1;

  //TODO: add success input
  console.log("Received advance request data " + JSON.stringify(data));
  return "accept";
}

async function handle_inspect(data) {
  const payload = data["payload"];

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
