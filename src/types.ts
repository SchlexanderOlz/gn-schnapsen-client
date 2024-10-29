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

interface CardEvent extends Event {
  data: Card;
}

export interface AddCard extends UserIdEvent {}
export interface RemoveCard extends UserIdEvent {}

export interface CardAvailable extends CardEvent {}

export interface CardUnavailable extends CardEvent {}

export interface CardPlayable extends CardEvent {}
export interface CardNotPlayable extends CardEvent {}

export interface DeckCardCountChange extends Event {
  data: number;
}

export interface PlayCard extends UserIdEvent {
  data: {
    user_id: string;
    card: Card;
  };
}

export interface FinalResult extends Event {
  data: {
    winner: string;
    ranked: any;
  };
}

export interface RoundResult extends Event {
  data: {
    winner: string;
    ranked: any;
    points: number;
  };
}

export interface CanAnnounce extends Event {
  data: {
    cards: [Card, Card];
    announce_type: "Forty" | "Twenty";
  };
}

export interface CannotAnnounce extends CanAnnounce {}

export interface Announcement extends CanAnnounce {
  data: {
    user_id: string;
    cards: [Card, Card];
    announce_type: "Forty" | "Twenty";
  };
}

export interface TrumpChangePossible extends Event {
  data: Card;
}
export interface TrumpChangeImpossible extends TrumpChangePossible {}