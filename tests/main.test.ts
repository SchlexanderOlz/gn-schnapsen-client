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
  "https://matchmaking.jjhost.at",
  "saus" + Math.random(),
  new SchnapsenClientBuilder()
);
let info: SearchInfo = {
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

  let onActive = async () => {
    console.log("Playing Card");

    await sleep(100);

    console.log("Availabel: " + JSON.stringify(client.cardsAvailable));
    console.log("Trump: " + JSON.stringify(client.trump));
    console.log("Playable: " + JSON.stringify(client.cardsPlayable));
    client.playCard(
      client.cardsPlayable[
        Math.floor(Math.random() * client.cardsPlayable.length)
      ]
    );
  };

  client.on("self:allow_draw_card", async () => {
    console.log("Drawing card");
    await sleep(1000);
    client.drawCard();
  });

  client.on("enemy_play_card", (event) => {
    console.log("Enemy Card Count after play: " + client.enemyCardCount);
  })

  client.on("enemy_receive_card", (event) => {
    console.log("Enemy Card Count after receive: " + client.enemyCardCount);
  })

  client.on("self:allow_play_card", onActive);

  client.on("play_card", (event) => {
    console.log(
      `Player ${event.data.user_id} played ${event.data.card.suit} ${event.data.card.value}`
    );
  });

  client.on("self:trick", (trick) => {
    console.log("Trick: " + trick);
  });

  client.on("self:card_available", (event) => {
    console.log(event);
  });

  client.on("self:card_unavailable", (event) => {
    console.log(event);
  });

  client.on("final_result", (event) => {
    console.log(event);
  });

  client.on("round_result", (result) => {
    client.disconnect();
    console.log("Round Result");
    console.log(result);
  });

  client.on("deck_card_count_change", (event) => {
    console.log("Number of card in deck: " + event);
  });
});
