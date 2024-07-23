import Navbar from "@/components/navbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default async function Home() {
  const pokemons: { src: string; name: string }[] = [];
  const data = await (await fetch("https://pokeapi.co/api/v2/pokemon/")).json();
  data.results.map((item: { url: string; name: string }) => {
    pokemons.push({
      src:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/" +
        item.url.split("/")[6] +
        ".svg",
      name: item.name,
    });
  });
  return (
    <>
      <Navbar />
      <section className="bg-white dark:bg-gray-900 min-h-[100vh]">
        <div className="p-[20px] grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-[20px]">
          {pokemons.map((pokemon, i) => (
            <div
              key={pokemon.name + i}
              className="shadow hover:opacity-[1] opacity-[0.8] transition-all w-[100%] h-[250px] bg-gray-50 dark:bg-gray-800 rounded-[20px]"
            >
              <Image
                width={400}
                className="w-[100%] h-[200px] object-contain p-[20px]"
                height={400}
                unoptimized
                src={pokemon.src}
                alt={pokemon.name}
              />
              <div className="font-semibold w-[100%] text-center">
                {" "}
                {pokemon.name}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
