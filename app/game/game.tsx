"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button"; // Assuming this path is correct
import { Input } from "@/components/ui/input"; // You'll need an Input component
import { ThemeToggle } from "@/components/theme-toggle"; // Assuming this path
import Navbar from "@/components/navbar"; // Assuming this path
import { useSpToken } from "socketpush-web";
import { sendEvent, useEvent } from "./helper";

// Props for your event functions (replace with actual types if available)
interface EventFunctions {
  useSpToken: () => string | null;
  useEvent: (callback: (event: string, data: string) => void) => void;
  sendEvent: (token: string, event: string, data: string) => Promise<void>;
}

interface Pokemon {
  id: string;
  src: string;
  name: string;
}

interface Card extends Pokemon {
  isFlipped: boolean;
  revealedBy: "me" | "opponent" | null;
  revealTimestamp: number | null;
  isInteractionPoint?: boolean; // To highlight the card that ended the game
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const PokemonFlipGame: React.FC = () => {
  const [myToken, setMyToken] = useState<string | null>(null);
  const [friendToken, setFriendToken] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Fetching your game token..."
  );

  const [cards, setCards] = useState<Card[]>([]);
  const [myScore, setMyScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [gameState, setGameState] = useState<"setup" | "playing" | "gameOver">(
    "setup"
  );
  const [gameResult, setGameResult] = useState<string>("");
  const [initialPokemons, setInitialPokemons] = useState<Pokemon[]>([]);

  const generatedMyToken = useSpToken();

  useEffect(() => {
    if (generatedMyToken) {
      setMyToken(generatedMyToken);
      setStatusMessage("Enter your friend's token to connect.");
    } else {
      setStatusMessage("Waiting for game token...");
    }
  }, [generatedMyToken]);

  const initializeOrResetGame = useCallback(() => {
    if (initialPokemons.length === 0) return; // Wait for pokemons to be fetched

    const gameCards = shuffleArray(initialPokemons).map((p, index) => ({
      ...p,
      id: `${p.name}`, // Ensure unique ID for each card instance
      isFlipped: false,
      revealedBy: null,
      revealTimestamp: null,
      isInteractionPoint: false,
    }));
    setCards(gameCards);
    setMyScore(0);
    setOpponentScore(0);
    setGameState("playing");
    setGameResult("");
    setStatusMessage("Game started! Your turn to flip.");
  }, [initialPokemons]);

  useEffect(() => {
    const fetchPokemons = async () => {
      try {
        const response = await fetch(
          "https://pokeapi.co/api/v2/pokemon/?limit=20"
        ); // Get 20 pokemons
        const data = await response.json();
        const fetchedPokemons = data.results.map(
          (item: { url: string; name: string }, index: number) => ({
            id: `${item.name}`,
            src: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/${
              item.url.split("/")[6]
            }.svg`,
            name: item.name,
          })
        );
        setInitialPokemons(fetchedPokemons);
      } catch (error) {
        console.error("Failed to fetch Pokémon:", error);
        setStatusMessage("Error fetching Pokémon data. Please refresh.");
      }
    };
    fetchPokemons();
  }, []);

  useEffect(() => {
    if (isConnected && initialPokemons.length > 0 && gameState === "setup") {
      initializeOrResetGame();
    }
  }, [isConnected, initialPokemons, gameState, initializeOrResetGame]);

  const checkAllCardsFlippedWin = useCallback(
    (
      updatedCards: Card[],
      currentMyScore: number,
      currentOpponentScore: number
    ) => {
      if (gameState === "gameOver") return false;

      if (updatedCards.every((card) => card.isFlipped)) {
        let resultText = "";
        if (currentMyScore > currentOpponentScore)
          resultText = "🎉 YOU WIN! You flipped more cards. 🎉";
        else if (currentOpponentScore > currentMyScore)
          resultText = "😥 OPPONENT WINS! They flipped more cards. 😥";
        else
          resultText =
            "🤝 IT'S A DRAW! Equal flips when all cards revealed. 🤝";

        setGameState("gameOver");
        setGameResult(resultText);
        setStatusMessage(resultText);
        if (friendToken) {
          sendEvent(
            friendToken,
            "GAME_ENDED",
            JSON.stringify({ reason: resultText, cardId: null })
          );
        }
        return true;
      }
      return false;
    },
    [gameState, friendToken]
  );

  const handleCardClick = (clickedCardId: string) => {
    if (gameState !== "playing" || !friendToken) return;

    const cardIndex = cards.findIndex((c) => c.id === clickedCardId);
    if (cardIndex === -1) return;

    const targetCard = cards[cardIndex];
    if (targetCard.isFlipped) return; // Already flipped

    const now = Date.now();
    let newMyScore = myScore;
    let newOpponentScore = opponentScore;

    const updatedCards = cards.map((c) =>
      c.id === clickedCardId
        ? {
            ...c,
            isFlipped: true,
            revealedBy: "me" as const,
            revealTimestamp: now,
          }
        : c
    );
    setCards(updatedCards);
    newMyScore++;
    setMyScore(newMyScore);

    sendEvent(
      friendToken,
      "FLIP_CARD",
      JSON.stringify({ cardId: clickedCardId, timestamp: now })
    ).then(() => {
      if (
        !checkAllCardsFlippedWin(updatedCards, newMyScore, newOpponentScore)
      ) {
        setStatusMessage("Card flipped! Waiting for opponent...");
      }
    });
  };

  useEvent(
    useCallback(
      (event: string, data: string) => {
        if (
          gameState === "gameOver" &&
          event !== "RESET_GAME_REQUEST" &&
          event !== "RESET_GAME_CONFIRMED"
        )
          return;

        const parsedData = JSON.parse(data);

        if (event === "FLIP_CARD") {
          const { cardId, timestamp: opponentTimestamp } = parsedData;
          console.log("Received flip card event:", cardId, opponentTimestamp);
          const cardIndex = cards.findIndex((c) => c.id === cardId);
          if (cardIndex === -1) return;

          let currentCards = [...cards]; // Operate on a copy for updates
          let targetCard = currentCards[cardIndex];
          let newMyScoreL = myScore;
          let newOpponentScoreL = opponentScore;

          if (targetCard.isFlipped) {
            // I already flipped this card
            if (targetCard.revealedBy === "me" && targetCard.revealTimestamp) {
              // Ensure it was me and timestamp exists
              let result = "";
              if (
                Math.abs(targetCard.revealTimestamp - opponentTimestamp) <=
                15000 * 4
              ) {
                result = "🤝 TIE! Same card picked within 15 seconds. 🤝";
              } else {
                result = "GAME OVER! Both picked the same card.";
              }
              setGameState("gameOver");
              setGameResult(result);
              setStatusMessage(result);
              currentCards = currentCards.map((c) =>
                c.id === cardId ? { ...c, isInteractionPoint: true } : c
              );
              setCards(currentCards);
              if (friendToken) {
                sendEvent(
                  friendToken,
                  "GAME_ENDED",
                  JSON.stringify({ reason: result, cardId })
                );
              }
            }
          } else {
            // Opponent is the first to flip this card
            currentCards = currentCards.map((c) =>
              c.id === cardId
                ? {
                    ...c,
                    isFlipped: true,
                    revealedBy: "opponent" as const,
                    revealTimestamp: opponentTimestamp,
                  }
                : c
            );
            setCards(currentCards);
            newOpponentScoreL++;
            setOpponentScore(newOpponentScoreL);
            if (
              !checkAllCardsFlippedWin(
                currentCards,
                newMyScoreL,
                newOpponentScoreL
              )
            ) {
              setStatusMessage("Opponent flipped a card. Your turn!");
            }
          }
        } else if (event === "GAME_ENDED") {
          if (gameState === "gameOver") return; // Avoid redundant updates
          const { reason, cardId } = parsedData;
          setGameState("gameOver");
          setGameResult(reason);
          setStatusMessage(reason);
          if (cardId) {
            setCards((prevCards) =>
              prevCards.map((c) =>
                c.id === cardId ? { ...c, isInteractionPoint: true } : c
              )
            );
          }
        } else if (event === "RESET_GAME_REQUEST") {
          // Optional: Add a confirmation step here if desired
          setStatusMessage(
            "Opponent wants to play again! Initializing new game..."
          );
          initializeOrResetGame();
          if (friendToken)
            sendEvent(friendToken, "RESET_GAME_CONFIRMED", JSON.stringify({}));
        } else if (event === "RESET_GAME_CONFIRMED") {
          setStatusMessage("Opponent confirmed new game. Starting...");
          initializeOrResetGame();
        }
      },
      [
        cards,
        myScore,
        opponentScore,
        friendToken,
        checkAllCardsFlippedWin,
        gameState,
        initializeOrResetGame,
      ]
    )
  );

  const handleConnect = () => {
    if (friendToken && myToken) {
      setIsConnected(true);
      setStatusMessage("Connected! Initializing game...");
      // Optionally send a PING or CONNECTED event to friend to confirm channel works
      // sendEvent(friendToken, 'PLAYER_CONNECTED_PING', JSON.stringify({ sender: myToken }));
    } else {
      setStatusMessage(
        "Please ensure your token is generated and friend's token is entered."
      );
    }
  };

  const handlePlayAgain = () => {
    if (!friendToken) return;
    setStatusMessage("Requesting a new game with opponent...");
    sendEvent(friendToken, "RESET_GAME_REQUEST", JSON.stringify({}));
    // initializeOrResetGame(); // Local reset will happen on confirmation or if opponent also requests
  };

  if (!myToken && gameState === "setup") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-xl text-gray-800 dark:text-gray-200">
          {statusMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-800">
      <Navbar /> {/* Assuming Navbar is self-contained */}
      <div className="absolute top-4 right-28">
        {" "}
        <ThemeToggle />
      </div>
      <main className="flex-grow p-4 md:p-6 lg:p-8">
        {gameState === "setup" && (
          <div className="flex flex-col items-center justify-center space-y-6 p-6 bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white">
              PokéFlip Duel!
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-300">
              Your Game Token (Share with friend):
            </p>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-center font-mono text-sm text-indigo-600 dark:text-indigo-400 break-all">
              {myToken || "Generating..."}
            </div>
            <Input
              type="text"
              value={friendToken}
              onChange={(e) => setFriendToken(e.target.value)}
              placeholder="Enter Friend's Token"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            <Button
              onClick={handleConnect}
              disabled={!friendToken || !myToken}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              Connect & Start Game
            </Button>
            <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
              {statusMessage}
            </p>
          </div>
        )}

        {(gameState === "playing" || gameState === "gameOver") && (
          <>
            <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg text-center">
              <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-2">
                {gameState === "gameOver" ? "Game Over!" : "Flip the Cards!"}
              </h2>
              {gameState === "gameOver" && (
                <p className="text-xl font-semibold text-green-600 dark:text-green-400 mb-3">
                  {gameResult}
                </p>
              )}
              <p className="text-md text-gray-700 dark:text-gray-300 mb-1">
                Your Score: {myScore} | Opponen&apos;s Score: {opponentScore}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {statusMessage}
              </p>
              {gameState === "gameOver" && (
                <Button
                  onClick={handlePlayAgain}
                  className="mt-4 py-2 px-5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg shadow transition-transform transform hover:scale-105"
                >
                  Play Again?
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4 perspective">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`card-container w-full aspect-[3/4] cursor-pointer transition-all duration-300 ease-in-out ${
                    card.isInteractionPoint ? "ring-4 ring-red-500" : ""
                  }`}
                  onClick={() => handleCardClick(card.id)}
                  style={{ perspective: "1000px" }}
                >
                  <div
                    className={`card-inner w-full h-full relative rounded-lg shadow-lg transition-transform duration-700 ease-out ${
                      card.isFlipped ? "rotate-y-180" : ""
                    }`}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Card Back */}
                    <div
                      className="card-face card-back absolute w-full h-full bg-gradient-to-br from-blue-500 to-indigo-700 dark:from-blue-700 dark:to-indigo-900 rounded-lg flex items-center justify-center p-2"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <Image
                        src="/pokeball.svg"
                        alt="Card Back"
                        width={80}
                        height={80}
                        unoptimized
                        className="opacity-80 w-1/2 h-auto"
                      />
                    </div>
                    {/* Card Front */}
                    <div
                      className={`card-face card-front absolute w-full h-full bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center p-2 overflow-hidden ${
                        card.revealedBy === "me"
                          ? "ring-2 ring-green-500"
                          : card.revealedBy === "opponent"
                          ? "ring-2 ring-yellow-500"
                          : ""
                      }`}
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <Image
                        width={120}
                        height={120}
                        className="w-full h-[70%] object-contain p-1"
                        unoptimized
                        src={card.src}
                        alt={card.name}
                        onError={(e) => (e.currentTarget.src = "/pokeball.svg")} // Fallback image
                      />
                      <p className="font-semibold text-center text-xs md:text-sm mt-1 truncate w-full px-1 text-gray-800 dark:text-gray-200">
                        {card.name.charAt(0).toUpperCase() + card.name.slice(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <style jsx global>{`
        .perspective {
          perspective: 1000px;
        }
        .card-container {
          // ensures the click area is consistent during animation
        }
        .card-inner {
          // transform-style: preserve-3d; // Handled inline for clarity
          // transition: transform 0.7s cubic-bezier(0.4, 0.0, 0.2, 1); // Example timing
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .card-face {
          // backface-visibility: hidden; // Handled inline for clarity
          // position: absolute;
          // width: 100%;
          // height: 100%;
        }
        .card-front {
          // transform: rotateY(180deg); // Handled inline for clarity
        }
      `}</style>
    </div>
  );
};

export default PokemonFlipGame;
