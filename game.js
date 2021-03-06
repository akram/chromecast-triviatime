var canvas  = document.querySelector("canvas"),
    players = {}, playerList = [],
    correctThisRound = 0, iCurrentQuestion = -1, countDown = 0;

canvas.width  = 500;
canvas.height = 500;

function initReceiver() {
  window.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();
  var appConfig = new cast.receiver.CastReceiverManager.Config();

  appConfig.statusText = 'Ready to play';
  appConfig.maxInactivity = 6000;

  window.messageBus = window.castReceiverManager.getCastMessageBus('urn:x-cast:de.geekonaut.triviatime');
  window.castReceiverManager.start(appConfig);

  window.castReceiverManager.onReady = function(event) {
    console.log('Received Ready event: ' + JSON.stringify(event.data));
    window.castReceiverManager.setApplicationState("Application status is ready...");
  };

  window.castReceiverManager.onSenderConnected = function(event) {
    console.log('Received Sender Connected event: ' + event.data);
    console.log(window.castReceiverManager.getSender(event.data).userAgent);
  };

  window.messageBus.onMessage = function(msg) {
    // the only message we can get is the start message!
    canvas.className = 'hidden';
    document.getElementById("answers").className = '';

    setCountdown();    
  }
}

function initPeerSession() {
  var peer = new Peer({key: '7nxxqfxzhestt9'});
  window.peer = peer;

  peer.on('open', function(id) {
    qr.canvas({
      canvas: canvas,
      value: 'http://akram.github.io/chromecast-triviatime/controls.html#' + id
    });
  });

  peer.on('connection', function(c) {
    console.log("CONTROLS ESTABLISHED", c);

    c.on('data', function(data) {
      if(data.type == 'HI') { // Player registered
        players[c.peer] = {name: data.name, score: 0};
        playerList.push(players[c.peer]);
        console.log("Player joined", data.name);
        window.messageBus.broadcast(JSON.stringify(playerList));
      } else { // Answer given
        console.log("Received Answer:", data.answer);

        // avoid duplicated answers per player
        if(players[c.peer].answered) return;
        players[c.peer].answered = true;

        if(data.answer === QUESTIONS[iCurrentQuestion].correct) {
          players[c.peer].score += 1 + (5 - correctThisRound);
          c.send({type: 'score', value: players[c.peer].score});
          correctThisRound++;
        } else {
          c.send({type: 'score', value: --players[c.peer].score});
        }
        updateLeaderboard();
      }
    });
  });
}

function setCountdown() {
  if(countDown == 0) {
    iCurrentQuestion++;
    correctThisRound = 0;
    for(var player in players) {
      if(!players.hasOwnProperty(player)) continue;
      players[player].answered = false;
    }
    document.querySelector("#question").textContent = QUESTIONS[iCurrentQuestion].question;

    for(var i=0;i<4;i++) {
      document.querySelector("#answer" + i + " p").textContent = QUESTIONS[iCurrentQuestion].choices[i];
    }
    countDown = 30;
  }

  countDown--;
  document.getElementById("countdown").textContent = countDown + "s";

  setTimeout(setCountdown, 1000);
}

function updateLeaderboard() {
  var playerRankings = [];
  for(var player in players) {
    if(!players.hasOwnProperty(player)) continue;
    playerRankings.push(players[player]);
  }
  playerRankings.sort(function(a,b) { return a.score - b.score; }).reverse();
  window.messageBus.broadcast(JSON.stringify(playerRankings.slice(0,10)));
}

window.onload = function() {
  initReceiver();
  initPeerSession();
};
