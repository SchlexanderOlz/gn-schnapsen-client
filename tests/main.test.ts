import { sleep } from "bun";
import {
  GameServerWriteClient,
  MatchMaker,
  type GameServerClientBuilder,
  type Match,
  type SearchInfo,
} from "gn-matchmaker-client";

import SchnapsenClient,  { SchnapsenClientBuilder } from "../src/index";

const sessionToken = process.argv[2] ? process.argv[2] : "test";


let instance = new MatchMaker(
  "http://127.0.0.1:4000",
  "saus" + Math.random(),
  sessionToken,
  new SchnapsenClientBuilder()
);
let info: SearchInfo = {
  region: "eu-central-1",
  game: "Schnapsen",
  mode: "duo",
  ai: "Kolfgang Woscher"
};
instance.search(info);


instance.on("match", (client: SchnapsenClient) => {

  console.log("Match found");

  let stop = false;
  let wait = false;

  let onActive = async () => {
    await sleep(800);
    if (stop) return;
    while (wait) {
      await sleep(100);
    }

    if (!client.allowPlayCard) {
      return;
    }

    console.log("Playing card");

    client.playCard(
      client.cardsPlayable[
        Math.floor(Math.random() * client.cardsPlayable.length)
      ]
    );

  };

  client.on("self:allow_draw_card", async () => {
    client.drawCard();
  });

  client.on("self:card_playable", (event) => console.log(event))



  client.on("enemy_play_card", (event) => {
  })

  client.on("enemy_receive_card", (event) => {
  })

  client.on("self:allow_play_card", onActive);

  client.on("play_card", (event) => {
    console.log(
      `Player ${event.data.user_id} played ${event.data.card.suit} ${event.data.card.value} with ${event.data.announcement} `
    );
  });

  client.on("self:trick", (trick) => {
    console.log(trick);
  });

  client.on("self:card_available", (event) => {
  });

  client.on("self:can_announce", async (event) => {
    while (!client.allowAnnounce) {
        await sleep(100);
    }
    stop = true;

    client.announce20(event.data.cards);

    await sleep(1000)
    client.playCard(client.cardsPlayable[0]);
    await sleep(1000)
    stop = false;
  })

  client.on("close_talon", (event) => {
    console.log("Close Talon by " + event.data.user_id);
  })

  client.on("self:allow_play_card", () => {
  });

  client.on("self:allow_announce", (event) => {
  });

  client.on("self:cannot_announce", (event) => {
  })

  client.on("self:card_unavailable", (event) => {
  });

  client.on("final_result", (event) => {
  });

  client.on("timeout", (event) => {
    console.log("Timeout by " + event.user_id);
  })


  client.on("round_result", (result) => {
    client.disconnect();
    console.log("Round Result");
    console.log(result);
  });

  client.on("deck_card_count_change", (event) => {
    console.log("Number of card in deck: " + client.deckCardCount);
  });

  client.on("trick", (event) => {
    console.log("Enemy Trick Count: " + client.enemyTrickCount);
    console.log("Self Trick Count: " + client.tricks.length);

    console.log("First enemy trick" + client.enemyFirstTrick);
  });

  client.on("self:score", (event) => {
    console.log("SCORE SCORE SCORE");
    console.log("Score: " + client.score);
  })
});
