const fs = require("fs");
const mangaList = require("./hardcodedManga");

// function to generate a random price
function generateRandomPrice(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// function to create a JS object string representation
function toObjectString(manga) {
  const entries = Object.entries(manga).map(([key, value]) => {
    // for strings, include them in quotes. Otherwise, include as is.
    const formattedValue = typeof value === "string" ? `\`${value}\`` : value;
    return `  ${key}: ${formattedValue}`;
  });
  return `{\n${entries.join(",\n")}\n}`;
}

// transform each manga object into a string representation and join with commas
const mangaObjectsString = mangaList
  .map((manga) => {
    manga.price = `$${generateRandomPrice(10.99, 21.99)}`;
    return toObjectString(manga);
  })
  .join(",\n\n");

const content = `const hardcodedManga = [\n${mangaObjectsString}\n];\n\nmodule.exports = hardcodedManga;`;

// Write the updated manga list to a new .js file
fs.writeFile("updatedHardcodedManga.js", content, (err) => {
  if (err) throw err;
  console.log("The file has been saved with updated prices!");
});
