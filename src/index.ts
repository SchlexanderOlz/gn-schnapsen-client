import {
  GameServerWriteClient,
  MatchMaker,
  type GameServerClientBuilder,
  type Match,
  type SearchInfo,
} from "gn-matchmaker-client";
import type {
  Active,
  AnnouncementEvent,
  CanAnnounce,
  CannotAnnounce,
  Card,
  CardAvailable,
  CardNotPlayable,
  CardPlayable,
  CardUnavailable,
  FinalResult,
  Inactive,
  PlayCard,
  AddCard,
  RoundResult,
  Trick,
  TrumpChange,
  TrumpChangeImpossible,
  TrumpChangePossible,
  RemoveCard,
  DeckCardCountChange,
  Score,
  Announcement,
} from "./types.js";
export * as types from "./types.js";

interface SchnapsenClientEvents {
  // General Events
  active: Active;
  announcement: AnnouncementEvent;
  can_play: null;
  final_result: FinalResult;
  finished_distribution: null;
  inactive: Inactive;
  play_card: PlayCard;
  round_result: RoundResult;
  score: Score;
  trump_change: { user_id: string; card: Card | null };
  trick: Trick;
  enemy_receive_card: AddCard;
  enemy_play_card: PlayCard;
  deck_card_count_change: number; // Number of cards in the deck

  // Player Events
  "self:active": null;
  "self:allow_announce": null;
  "self:allow_draw_card": null;
  "self:allow_play_card": null;
  "self:announcement": CanAnnounce;
  "self:card_available": CardAvailable;
  "self:card_not_playable": Card;
  "self:card_playable": Card;
  "self:card_unavailable": CardUnavailable;
  "self:cannot_announce": CannotAnnounce;
  "self:can_announce": CanAnnounce;
  "self:inactive": null;
  "self:lost_match": number;
  "self:lost_round": number;
  "self:play_card": { card: Card; announcement?: Announcement };
  "self:result_match": number;
  "self:score": number;
  "self:trick": [Card, Card];
  "self:trump_change": TrumpChange;
  "self:trump_change_impossible": TrumpChangeImpossible;
  "self:trump_change_possible": TrumpChangePossible;
  "self:won_match": number;
  "self:won_round": number;
}

// TODO: Handle failures to send
export default class SchnapsenClient extends GameServerWriteClient {
  private _announcements: Map<string, Announcement[]> = new Map();
  private _isActive: boolean = false;
  private _cards: Card[] = [];
  private _trump: Card | null = null;
  private _ready: boolean = false;
  private _playableCards: Card[] = [];
  private _tricks: Map<string, [Card, Card][]> = new Map();
  private _cardCount: Map<string, number> = new Map();
  private _stack: Card[] = [];
  private _announceable: CanAnnounce[] = [];
  private _announcing: Map<string, Announcement> = new Map();
  private _active: string = "";
  private _cardForTrumpChange: Card | null = null;
  private _deckCardCount: number = 9;
  private _scores: Map<string, number> = new Map();
  private _allowAnnounce: boolean = false;
  private _allowPlayCard: boolean = false;
  private _allowDrawCard: boolean = false;

  constructor(userId: string, match: Match) {
    super(userId, match);

    this.socket.on("active", this.handleEventActive.bind(this));
    this.socket.on("allow_announce", this.handleEventAllowAnnounce.bind(this));
    this.socket.on("allow_draw_card", this.handleEventAllowDrawCard.bind(this));
    this.socket.on("allow_play_card", this.handleEventAllowPlayCard.bind(this));
    this.socket.on("announce", this.handleEventAnnouncement.bind(this));
    this.socket.on("can_announce", this.handleEventCanAnnounce.bind(this));
    this.socket.on(
      "cannot_announce",
      this.handleEventCannotAnnounce.bind(this)
    );
    this.socket.on("receive_card", this.handleEventReceiveCard.bind(this));
    this.socket.on("card_available", this.handleEventCardAvailable.bind(this));
    this.socket.on(
      "card_not_playable",
      this.handleEventCardNotPlayable.bind(this)
    );
    this.socket.on("card_playable", this.handleEventCardPlayable.bind(this));
    this.socket.on(
      "card_unavailable",
      this.handleEventCardUnavailable.bind(this)
    );
    this.socket.on("final_result", this.handleEventFinalResult.bind(this));
    this.socket.on(
      "finished_distribution",
      this.handleEventFinishedDistribution.bind(this)
    );
    this.socket.on("inactive", this.handleEventInactive.bind(this));
    this.socket.on("play_card", this.handleEventPlayCard.bind(this));
    this.socket.on("result", this.handleEventRoundResult.bind(this));
    this.socket.on("trick", this.handleEventTrick.bind(this));
    this.socket.on("trump_change", this.handleEventTrumpChange.bind(this));
    this.socket.on(
      "trump_change_impossible",
      this.handleEventTrumpChangeImpossible.bind(this)
    );
    this.socket.on(
      "trump_change_possible",
      this.handleEventTrumpChangePossible.bind(this)
    );

    this.socket.on(
      "deck_card_count",
      this.handleEventDeckCardCountChange.bind(this)
    );

    this.socket.on("score", this.handleEventScore.bind(this));

    this.socket.onAny((event, ...args) => {
      console.log(event, args);
    });

    this.on("self:active", this.onSelfActive.bind(this));
    this.on("self:inactive", this.onSelfInactive.bind(this));

    this.on("self:trump_change", (event: TrumpChange) => {
      this._trump = event.data;
    });
  }

  public get cardsAvailable(): Card[] {
    return this._cards;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get trump(): Card | null {
    return this._trump;
  }

  public get isReady(): boolean {
    return this._ready;
  }

  public get cardsPlayable(): Card[] {
    return this._playableCards;
  }

  public get tricks(): [Card, Card][] {
    return this._tricks.get(this.userId) ?? [];
  }

  public get stack(): Card[] {
    return this._stack;
  }

  public get announceable(): CanAnnounce[] | null {
    return this._announceable;
  }

  public get cardForTrumpChange(): Card | null {
    return this._cardForTrumpChange;
  }

  public get enemyTricks(): [Card, Card][] {
    for (const key of this._tricks.keys()) {
      if (key !== this.userId) {
        return this._tricks.get(key) ?? [];
      }
    }
    return [];
  }

  public get trickCount(): number {
    return this._tricks.get(this.userId)?.length ?? 0;
  }

  public get totalTrickCount(): number {
    return this.trickCount + this.enemyTrickCount;
  }

  public get score(): number {
    return this.getScore(this.userId);
  }

  public get enemyScore(): number {
    for (const key of this._scores.keys()) {
      if (key !== this.userId) {
        return this._scores.get(key) ?? 0;
      }
    }
    return 0;
  }

  // NOTE: Alle enemy... function do only work for duo-schnapsen. Fix this for other modes!
  public get enemyFirstTrick(): [Card, Card] | undefined {
    for (const key of this._tricks.keys()) {
      if (key !== this.userId) {
        return this._tricks.get(key)?.at(0);
      }
    }
    return undefined;
  }

  public get enemyTrickCount(): number {
    for (const key of this._tricks.keys()) {
      if (key !== this.userId) {
        return this._tricks.get(key)?.length ?? 0;
      }
    }
    return 0;
  }

  public get firstTrick(): [Card, Card] | undefined {
    return this._tricks.get(this.userId)?.at(0);
  }

  public get deckCardCount(): number {
    return this._deckCardCount;
  }

  /**
   * @deprecated
   */
  public get announcement(): Announcement[] | undefined {
    return this._announcements.get(this.userId);
  }

  public get announcements(): Announcement[] | undefined {
    return this._announcements.get(this.userId);
  }

  public get enemyAnnouncement(): Announcement[] | undefined {
    for (const key of this._announcements.keys()) {
      if (key !== this.userId) {
        return this._announcements.get(key);
      }
    }
  }

  // NOTE: This implementation does only work for duo-schnapsen. It will not work for other modes.
  public get enemyCardCount(): number {
    for (const key of this._cardCount.keys()) {
      if (key != this.userId) {
        return this._cardCount.get(key) ?? 0;
      }
    }
    return 0;
  }

  public get allowAnnounce(): boolean {
    return this._allowAnnounce;
  }

  public get allowPlayCard(): boolean {
    return this._allowPlayCard;
  }

  public get allowDrawCard(): boolean {
    return this._allowDrawCard;
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

  public disconnect() {
    this.socket.disconnect();
  }

  getScore(userId: string): number {
    return this._scores.get(userId) ?? 0;
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

  announce20(cards: Card[]) {
    if (!this._isActive) return;
    this.socket.emit("announce_20", cards);
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

  protected handleEventAllowDrawCard() {
    this._allowDrawCard = true;
    this.emit("self:allow_draw_card");
  }

  protected handleEventAllowPlayCard() {
    this._allowPlayCard = true;
    this.emit("self:allow_play_card");
  }

  protected handleEventActive(event: Active) {
    this._active = event.data.user_id;
    if (event.data.user_id === this.userId) {
      this.emit("self:active");
    }
    this.emit("active", event);
  }

  private resetGuards() {
    this._allowDrawCard = false;
    this._allowPlayCard = false;
    this._allowAnnounce = false;
  }

  protected handleEventInactive(event: Inactive) {
    if (event.data.user_id === this.userId) {
      this.resetGuards();
      this.emit("self:inactive");
    }
    this.emit("inactive", event);
  }

  protected handleEventTrick(event: Trick) {
    this._stack = [];

    const tricks = this._tricks.get(event.data.user_id);
    if (tricks == null) {
      this._tricks.set(event.data.user_id, [event.data.cards]);
    } else {
      this._tricks.set(event.data.user_id, [...tricks, event.data.cards]);
    }

    if (event.data.user_id === this.userId) {
      this.emit("self:trick", event.data.cards);
    }

    this.emit("trick", event);
  }

  protected handleEventCardAvailable(event: CardAvailable) {
    this._cards.push(event.data);
    this.emit("self:card_available", event);
  }

  protected handleEventCardUnavailable(event: CardUnavailable) {
    this._cards = this._cards.filter(
      (card) =>
        !(card.suit == event.data.suit && card.value == event.data.value)
    );
    this._playableCards = this._playableCards.filter(
      (card) =>
        !(card.suit == event.data.suit && card.value == event.data.value)
    );
    this.emit("self:card_unavailable", event);
  }

  protected handleEventDeckCardCountChange(event: DeckCardCountChange) {
    this._deckCardCount = event.data;
    this.emit("deck_card_count_change", event.data);
  }

  protected handleEventTrumpChange(event: TrumpChange) {
    let user_id = this._active;
    if (this._trump == null || event.data == null) {
      user_id = "server";
    }
    this.emit("trump_change", { user_id, card: event.data });

    if (this._active === this.userId) {
      this.emit("self:trump_change", event);
    }
  }

  protected handleEventFinishedDistribution() {
    this._ready = true;
    console.log("Finished distribution");
    this.emit("finished_distribution");
    if (this._isActive) this.emit("can_play");
  }

  protected handleEventPlayCard(event: PlayCard) {
    this._stack.push(event.data.card);

    this._cardCount.set(
      event.data.user_id,
      (this._cardCount.get(event.data.user_id) ?? 0) - 1
    );

    let announcement = this._announcing.get(event.data.user_id);
    this._announcing.delete(event.data.user_id);

    event.data.announcement = announcement;

    if (event.data.user_id == this.userId) {
      this.emit("self:play_card", event.data);
    } else {
      this.emit("enemy_play_card", event);
    }
    this.emit("play_card", event);
  }

  protected handleEventCardNotPlayable(event: CardNotPlayable) {
    console.log(event);
    this._playableCards = this._playableCards.filter(
      (card) =>
        !(card.suit == event.data.suit && card.value == event.data.value)
    );
    this.emit("self:card_not_playable", event.data);
  }

  protected handleEventReceiveCard(event: AddCard) {
    this._cardCount.set(
      event.data.user_id,
      (this._cardCount.get(event.data.user_id) ?? 0) + 1
    );
    this.emit("enemy_receive_card", event);
  }

  protected handleEventCardPlayable(event: CardPlayable) {
    this._playableCards.push(event.data);
    this.emit("self:card_playable", event.data);
  }

  protected handleEventFinalResult(event: FinalResult) {
    this.emit("final_result", event);
    this.emit("self:result_match", event.data.ranked[this.userId]);
    if (event.data.winner == this.userId)
      this.emit("self:won_match", event.data.ranked[this.userId]);
    else this.emit("self:lost_match", event.data.ranked[this.userId]);
  }

  protected handleEventRoundResult(event: RoundResult) {
    this.emit("round_result", event);
    if (event.data.winner == this.userId)
      this.emit("self:won_round", event.data.points);
    else this.emit("self:lost_round", event.data.points);
  }

  protected handleEventScore(event: Score) {
    this._scores.set(event.data.user_id, event.data.points);
    if (event.data.user_id === this.userId) {
      this.emit("self:score", event.data.points);
    }
    this.emit("score", event);
  }

  protected handleEventCanAnnounce(event: CanAnnounce) {
    this._announceable.push(event);
    this.emit("self:can_announce", event);
  }

  protected handleEventAnnouncement(event: AnnouncementEvent) {
    this._announcing.set(event.data.user_id, event.data);

    console.log("Announcing " + this._announcing);

    this._announcements.set(event.data.user_id, [
      event.data,
      ...(this._announcements.get(event.data.user_id) ?? []),
    ]);

    if (event.data.user_id === this.userId) {
      this.emit("self:announcement", event);
    }

    this.emit("announcement", event);
  }

  protected handleEventTrumpChangePossible(event: TrumpChangePossible) {
    this._cardForTrumpChange = event.data;
    this.emit("self:trump_change_possible", event);
  }

  protected handleEventTrumpChangeImpossible(event: TrumpChangeImpossible) {
    this._cardForTrumpChange = null;
    this.emit("self:trump_change_impossible", event);
  }

  protected handleEventAllowAnnounce() {
    this._allowAnnounce = true;
    this.emit("self:allow_announce");
  }

  protected handleEventCannotAnnounce(event: CannotAnnounce) {
    this._announceable.filter(
      (announce) =>
        announce.data.announce_type !== event.data.announce_type ||
        announce.data.cards[0].suit !== event.data.cards[0].suit
    );
    this.emit("self:cannot_announce", event);
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
