import { sleep } from "bun";
import {
  GameServerWriteClient,
  MatchMaker,
  type GameServerClientBuilder,
  type Match,
  type SearchInfo,
} from "gn-matchmaker-client";

export enum CardVal {
  Ten = "Ten",
  Jack = "Jack",
  Queen = "Queen",
  King = "King",
  Ace = "Ace",
}

export enum CardSuit {
  Hearts = "Hearts",
  Diamonds = "Diamonds",
  Clubs = "Clubs",
  Spades = "Spades",
}

export interface Card {
  value: CardVal;
  suit: CardSuit;
}

export interface Event {
  event: string;
  data: any;
}

interface UserIdEvent extends Event {
  data: {
    user_id: string;
  };
}

export interface Active extends UserIdEvent {}
export interface Inactive extends UserIdEvent {}
export interface Trick extends UserIdEvent {
  data: {
    user_id: string;
    cards: [Card, Card];
  };
}

export interface TrumpChange extends Event {
  data: Card;
}

export interface CardAvailable extends Event {
  data: Card;
}

export interface CardUnavailable extends Event {
  data: Card;
}

export interface PlayCard extends UserIdEvent {
  data: {
    user_id: string;
    card: Card;
  };
}

interface SchnapsenClientEvents {
  "self:active": null;
  active: Active;
  inactive: Inactive;
  "self:inactive": null;
  trick: Trick;
  "self:trick": [Card, Card];
  "self:card_available": CardAvailable;
  "self:card_unavailable": CardUnavailable;
  trump_change: TrumpChange;
  finished_distribution: null;
  can_play: null;
  play_card: PlayCard;
  "self:play_card": Card;
}

// TODO: Handle failures to send
export class SchnapsenClient extends GameServerWriteClient {
  private _isActive: boolean = false;
  private _cards: Card[] = [];
  private _trump: Card | null = null;
  private _ready: boolean = false;

  constructor(userId: string, match: Match) {
    super(userId, match);
    console.log(match);

    this.socket.on("active", this.handleEventActive.bind(this));
    this.socket.on("inactive", this.handleEventInactive.bind(this));
    this.socket.on("trick", this.handleEventTrick.bind(this));
    this.socket.on("trump_change", this.handleEventTrumpChange.bind(this));
    this.socket.on(
      "finished_distribution",
      this.handleEventFinishedDistribution.bind(this)
    );
    this.socket.on("play_card", this.handleEventPlayCard.bind(this));

    this.socket.on("card_available", this.handleEventCardAvailable.bind(this));
    this.socket.on(
      "card_unavailable",
      this.handleEventCardUnavailable.bind(this)
    );

    this.on("self:active", this.onSelfActive.bind(this));
    this.on("self:inactive", this.onSelfInactive.bind(this));

    this.on("self:card_available", (event: CardAvailable) => {
      this._cards.push(event.data);
    });

    this.on("self:card_unavailable", (event: CardUnavailable) => {
      this._cards = this._cards.filter((card) => card != event.data);
    });

    this.on("trump_change", (event: TrumpChange) => {
      this._trump = event.data;
    });
  }

  public get cardsAvailable(): Card[] {
    return this._cards;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get trump(): Card {
    if (this._trump == null) throw new Error("Trump is not set");
    return this._trump;
  }

  public get isReady(): boolean {
    return this._ready;
  }

  public on<K extends keyof SchnapsenClientEvents>(
    event: K,
    listener: (payload: SchnapsenClientEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  public emit<K extends keyof SchnapsenClientEvents>(
    event: K,
    payload?: SchnapsenClientEvents[K]
  ): boolean {
    return super.emit(event, payload);
  }

  playCard(card: Card) {
    if (!this._isActive) return;
    this.socket.emit("play_card", card);
  }

  swapTrump(card: Card) {
    if (!this._isActive) return;
    this.socket.emit("swap_trump", card);
  }

  closeTalon() {
    if (!this._isActive) return;
    this.socket.emit("close_talon");
  }

  announce20() {
    if (!this._isActive) return;
    this.socket.emit("announce_20");
  }

  announce40() {
    if (!this._isActive) return;
    this.socket.emit("announce_40");
  }

  drawCard() {
    if (!this._isActive) return;
    this.socket.emit("draw_card");
  }

  cuttDeck(index: number) {
    this.socket.emit("cutt_deck", index);
  }

  takeCards(index: number) {
    this.socket.emit("take_cards", index, (err: any) => {});
  }

  protected handleEventActive(event: Active) {
    console.log(event);
    if (event.data.user_id === this.userId) this.emit("self:active");
    this.emit("active", event);
  }

  protected handleEventInactive(event: Inactive) {
    console.log(event);
    if (event.data.user_id === this.userId) this.emit("self:inactive");
    this.emit("inactive", event);
  }

  protected handleEventTrick(event: Trick) {
    if (event.data.user_id == this.userId)
      this.emit("self:trick", event.data.cards);
    this.emit("trick", event);
  }

  protected handleEventCardAvailable(event: CardAvailable) {
    this.emit("self:card_available", event);
  }

  protected handleEventCardUnavailable(event: CardUnavailable) {
    this.emit("self:card_unavailable", event);
  }

  protected handleEventTrumpChange(event: TrumpChange) {
    this.emit("trump_change", event);
  }

  protected handleEventFinishedDistribution() {
    this._ready = true;
    this.emit("finished_distribution");
    if (this._isActive) this.emit("can_play");
  }

  protected handleEventPlayCard(event: PlayCard) {
    if (event.data.user_id == this.userId)
      this.emit("self:play_card", event.data.card);
    this.emit("play_card", event);
  }

  private onSelfActive() {
    this._isActive = true;
  }

  private onSelfInactive() {
    this._isActive = false;
  }
}

export class SchnapsenClientBuilder
  implements GameServerClientBuilder<SchnapsenClient>
{
  fromMatch(userId: string, match: Match): SchnapsenClient {
    return new SchnapsenClient(userId, match);
  }
}

//////////////////////// EXAMPLE ////////////////////////
let instance = new MatchMaker(
  "http://127.0.0.1:4000",
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
    console.log("Active");

    while (!client.isReady) {
      await sleep(300);
    }

    console.log(client.cardsAvailable);
    client.off("self:active", onActive);
    client.playCard(
      client.cardsAvailable.filter((card) => card.suit == client.trump.suit)[0]
    );

    let draw = () => {
      client.drawCard();
      client.off("self:active", draw);
      client.on("self:active", onActive);
    };
    client.on("self:active", draw);
  };

  client.on("self:active", onActive);

  client.on("play_card", (event) => {
    console.log(
      `Player ${event.data.user_id} played ${event.data.card.suit} ${event.data.card.value}`
    );
  });

  client.on("trick", (trick) => {
    console.log(trick);
  });

  client.on("self:card_available", (event) => {
    console.log(event);
  });

  client.on("self:card_unavailable", (event) => {
    console.log(event);
  });
});
