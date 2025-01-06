import { sleep } from "bun";
import {
  GameServerWriteClient,
  MatchMaker,
  type GameServerClientBuilder,
  type Match,
  type SearchInfo,
} from "gn-matchmaker-client";

import SchnapsenClient, { SchnapsenClientBuilder } from "../src/index";

const sessionToken = process.argv[3] ? process.argv[3] : "test";
const clientCount = parseInt(process.argv[2]) || 1;

let exited_count = 0;
let timeout_count = 0;

const createClient = (index: number) => {
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
  };
  instance.search(info);

  instance.on("match", (client: SchnapsenClient) => {
    console.log(`Client ${index}: Match found`);

    let stop = false;
    let wait = false;
    let played_card = false;

    let onActive = async () => {
      played_card = false;
      await sleep(800);
      if (stop) return;
      played_card = true;

      while (wait) {
        await sleep(100);
      }

      if (!client.allowPlayCard) {
        return;
      }


      console.log(`Client ${index}: Playing card`);

      client.playCard(
        client.cardsPlayable[
          Math.floor(Math.random() * client.cardsPlayable.length)
        ]
      );
    };

    client.on("self:allow_play_card", onActive);

    client.on("self:can_announce", async (event) => {
      while (!client.allowAnnounce) {
        await sleep(100);
      }
    });

    client.on("self:allow_announce", async (event) => {
      stop = true;
      if (played_card) {
          stop = false;
          return;
      }

      const announce = client.announceable![0].data
      if (announce.announce_type == "Forty") {
        client.announce40();
      } else {
        client.announce20(announce.cards);
      }

      await sleep(1000);
      client.playCard(client.cardsPlayable[0]);
      await sleep(1000);
      stop = false;
    })

    client.on("timeout", (event) => {
      console.log(`Client ${index}: Timeout by ${event.user_id}`);

      timeout_count++;
      console.log(`Timeout count: ${timeout_count}`);
    });

    client.on("error", (error) => {
        console.log(`Client ${index}: Error: ${error}`);
        }
    );

    client.on("round_result", (result) => {
      client.disconnect();
      console.log(`Client ${index}: Round Result: ${result.data.winner} won`);
      exited_count++;

      console.log(`Exited count: ${exited_count}`);
    });
  });
};

for (let i = 0; i < clientCount; i++) {
  createClient(i);
}