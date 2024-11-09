import { sleep } from "bun";
import {
  GameServerWriteClient,
  MatchMaker,
  type GameServerClientBuilder,
  type Match,
  type SearchInfo,
} from "gn-matchmaker-client";

import SchnapsenClient,  { SchnapsenClientBuilder } from "../src/index";

let instance = new MatchMaker(
  "http://localhost:4000",
  "saus" + Math.random(),
  new SchnapsenClientBuilder()
);
let info: SearchInfo = {
  region: "eu",
  game: "Schnapsen",
  mode: {
    name: "duo",
    player_count: 2,
    computer_lobby: false,
  },
};
instance.search(info);

instance.on("_servers", (servers) => {
  console.log(servers);
});

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

    client.playCard(
      client.cardsPlayable[
        Math.floor(Math.random() * client.cardsPlayable.length)
      ]
    );
  };

  client.on("self:allow_draw_card", async () => {
    await sleep(1000);
    client.drawCard();
  });

  client.on("self:allow_close_talon", async () => {
    console.log("Close Talon");
    wait = true;
    client.closeTalon();
    await sleep(200);
    wait = false;
  })


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
  });

  client.on("self:card_available", (event) => {
  });

  client.on("self:can_announce", async (event) => {
    while (!client.allowAnnounce) {
        await sleep(100);
    }
    stop = true;
    client.announce20(event.data.cards);
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
