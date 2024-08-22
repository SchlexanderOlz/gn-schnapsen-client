import { sleep } from "bun";
import {
  GameServerWriteClient,
  MatchMaker,
  type GameServerClientBuilder,
  type Match,
  type SearchInfo,
} from "gn-matchmaker-client";
import type {
  Active,
  Announcement,
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
  RoundResult,
  Trick,
  TrumpChange,
  TrumpChangeImpossible,
  TrumpChangePossible,
} from "./types";
export * as types from "./types";

interface SchnapsenClientEvents {
  // General Events
  active: Active;
  announcement: Announcement;
  can_play: null;
  final_result: FinalResult;
  finished_distribution: null;
  inactive: Inactive;
  play_card: PlayCard;
  round_result: RoundResult;
  trick: Trick;

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
  "self:play_card": Card;
  "self:result_match": number;
  "self:trick": [Card, Card];
  "self:trump_change": TrumpChange;
  "self:trump_change_impossible": TrumpChangeImpossible;
  "self:trump_change_possible": TrumpChangePossible;
  "self:won_match": number;
  "self:won_round": number;
}

// TODO: Handle failures to send
export default class SchnapsenClient extends GameServerWriteClient {
  private _isActive: boolean = false;
  private _cards: Card[] = [];
  private _trump: Card | null = null;
  private _ready: boolean = false;
  private _playableCards: Card[] = [];
  private _tricks: [Card, Card][] = [];
  private _stack: Card[] = [];
  private _announceable: CanAnnounce | null = null;
  private _cardForTrumpChange: Card | null = null;

  constructor(userId: string, match: Match) {
    super(userId, match);

    this.socket.on("active", this.handleEventActive.bind(this));
    this.socket.on("allow_announce", this.handleEventAllowAnnounce.bind(this));
    this.socket.on("allow_draw_card", this.handleEventAllowDrawCard.bind(this));
    this.socket.on("allow_play_card", this.handleEventAllowPlayCard.bind(this));
    this.socket.on("announcement", this.handleEventAnnouncement.bind(this));
    this.socket.on("can_announce", this.handleEventCanAnnounce.bind(this));
    this.socket.on(
      "cannot_announce",
      this.handleEventCannotAnnounce.bind(this)
    );
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

  public get trump(): Card {
    if (this._trump == null) throw new Error("Trump is not set");
    return this._trump;
  }

  public get isReady(): boolean {
    return this._ready;
  }

  public get cardsPlayable(): Card[] {
    return this._playableCards;
  }

  public get tricks(): [Card, Card][] {
    return this._tricks;
  }

  public get stack(): Card[] {
    return this._stack;
  }

  public get announceable(): CanAnnounce | null {
    return this._announceable;
  }

  public get cardForTrumpChange(): Card | null {
    return this._cardForTrumpChange;
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

  protected handleEventAllowDrawCard() {
    this.emit("self:allow_draw_card");
  }

  protected handleEventAllowPlayCard() {
    this.emit("self:allow_play_card");
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
    this._stack = [];
    if (event.data.user_id === this.userId) {
      this._tricks.push(event.data.cards);
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

  protected handleEventTrumpChange(event: TrumpChange) {
    this.emit("self:trump_change", event);
  }

  protected handleEventFinishedDistribution() {
    this._ready = true;
    console.log("Finished distribution");
    this.emit("finished_distribution");
    if (this._isActive) this.emit("can_play");
  }

  protected handleEventPlayCard(event: PlayCard) {
    this._stack.push(event.data.card);
    if (event.data.user_id == this.userId)
      this.emit("self:play_card", event.data.card);
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

  protected handleEventCanAnnounce(event: CanAnnounce) {
    this._announceable = event;
    this.emit("self:can_announce", event);
  }

  protected handleEventAnnouncement(event: Announcement) {
    if (event.data.user_id == this.userId) {
      this._announceable = null;
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
    this.emit("self:allow_announce");
  }

  protected handleEventCannotAnnounce(event: CannotAnnounce) {
    this._announceable = null;
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
