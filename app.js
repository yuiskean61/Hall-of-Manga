const mongoose = require("mongoose");
const axios = require("axios");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/User");

const app = express();
const port = 8000;
const localDbUrl = "mongodb://localhost:27017/hallOfManga";

mongoose
  .connect(localDbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static("views"));
app.set("view engine", "pug");
app.set("views", "./views");

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    { usernameField: "username" },
    async (username, password, done) => {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          return done(null, false, { message: "No user with that username" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: "Password incorrect" });
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/search");
  } else {
    res.render("home", {
      title: "Welcome to the Hall of Manga",
      subtitle: "Explore Your Favorite Manga",
    });
  }
});

app.get("/index", async (req, res) => {
  await fetchManga("", "top");
  res.render("index", {
    user: req.user,
    mangaList: mangaList.top,
  });
});

// use to randomize list of manga
function shuffleTopManga(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}
// generates random prices to manga
function generateRandomPrice(min, max) {
  const price = Math.random() * (max - min) + min;
  return price.toFixed(2);
}

// global storage for manga lists
const mangaList = { top: [], search: [] };
// Fetch information from API and puts it into an object
async function fetchManga(query, type = "search") {
  let url;
  let params = {};

  if (type === "top") {
    url = "https://myanimelist.p.rapidapi.com/manga/top/manga";
    params = { limit: "10" };
  } else if (type === "search") {
    url = "https://myanimelist.p.rapidapi.com/v2/manga/search";
    params = {
      q: query,
      n: "10",
      score: "0",
    };
  } else {
    console.error("[Error] Unexpected type provided:", type);
    return [];
  }

  const options = {
    method: "GET",
    url: url,
    params: params,
    headers: {
      "X-RapidAPI-Key": "c0c9859a1bmshe37e959a489c72cp13b18fjsneeff19a81d52",
      "X-RapidAPI-Host": "myanimelist.p.rapidapi.com",
    },
  };

  console.log("[API] Request URL:", url);
  console.log("[API] Request Params:", params);

  try {
    const response = await axios.request(options);
    console.log("[API] Response Data:", response.data);
    const data = response.data;

    let results = [];
    if (type === "search" && data.data) {
      mangaList.search = data.data.map((item) => ({
        title: item.node.title,
        description: item.node.synopsis,
        picture_url: item.node.main_picture.medium,
        myanimelist_url: `https://myanimelist.net/manga/${item.node.id}`,
        myanimelist_id: item.node.id,
        price: `$${generateRandomPrice(10.99, 21.99)}`,
      }));
    } else if (type === "top" && response.data) {
      const shuffledData = shuffleTopManga(response.data);
      mangaList.top = shuffledData.slice(0, 10).map((manga) => ({
        title: manga.title,
        picture_url: manga.picture_url,
        myanimelist_url: manga.myanimelist_url,
        myanimelist_id: manga.myanimelist_id,
        rank: manga.rank,
        score: manga.score,
        type: manga.type,
        aired_on: manga.aired_on,
        price: `$${generateRandomPrice(10.99, 21.99)}`,
      }));
    }
    console.log(results);
    return results;
  } catch (error) {
    console.error("[Error] Error fetching manga:", error);
    return [];
  }
}

// hardcoded manga for search function
const hardcodedManga = require("./hardcodedManga");

app.get("/search", async (req, res) => {
  const { q: query } = req.query;
  console.log(`Received search query: ${query}`);
  if (!query) {
    console.log("No query provided for search.");
    return res.render("searchResults", {
      title: "Search Results",
      price: `$${generateRandomPrice(10.99, 21.99)}`,
      mangaList: [],
    });
  }

  // Use hardcodedManga as the search result
  const filteredManga = hardcodedManga.filter((manga) =>
    manga.title.toLowerCase().includes(query.toLowerCase())
  );
  console.log("Filtered manga based on query:", filteredManga);
  res.render("searchResults", {
    title: "Search Results",
    mangaList: filteredManga,
  });
});

// adding to cart
app.post("/add-to-cart", (req, res) => {
  const { myanimelist_id, title, price, picture_url } = req.body;

  if (!req.session.cart) {
    req.session.cart = [];
  }

  req.session.cart.push({ myanimelist_id, title, price, picture_url });

  res.redirect("/cart");
});

// Cart Route with Total Price Calculation
app.get("/cart", (req, res) => {
  let totalPrice = 0;
  if (req.session.cart && req.session.cart.length > 0) {
    totalPrice = req.session.cart.reduce((sum, item) => {
      // Ensure item has a price and it includes a dollar sign
      if (
        item.price &&
        typeof item.price === "string" &&
        item.price.includes("$")
      ) {
        return sum + parseFloat(item.price.replace("$", ""));
      }
      return sum;
    }, 0);
  }
  res.render("cart", { cart: req.session.cart || [], totalPrice });
});

// Remove from Cart Route
app.post("/remove-from-cart", (req, res) => {
  const { mangaId } = req.body; // Change to "mangaId" instead of "myanimelist_id"
  console.log("Removing manga with ID:", mangaId);

  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(
      (item) => item.myanimelist_id !== mangaId // Change to "mangaId" instead of "myanimelist_id"
    );
    console.log("Updated cart:", req.session.cart);
  }

  res.redirect("/cart");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/index",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }

    req.session.destroy(function (err) {
      if (err) {
        console.log(err);
      }
      res.redirect("/");
    });
  });
});

app.get("/cart", (req, res) => {
  res.render("cart", { cart: req.session.cart || [] });
});

// checkout route
app.get("/checkout", (req, res) => {
  console.log("Session ID:", req.sessionID);
  console.log("Cart Contents:", req.session.cart);
  const cart = req.session.cart || [];
  let total = cart.reduce(
    (acc, item) => acc + parseFloat(item.price.replace("$", "")),
    0
  );
  const taxRate = 0.13; // 13% tax
  const taxAmount = total * taxRate;
  const totalCostWithTax = total + taxAmount;

  res.render("checkout", {
    cart,
    total: total.toFixed(2),
    tax: taxAmount.toFixed(2),
    totalCostWithTax: totalCostWithTax.toFixed(2),
  });
});

app.post("/complete-order", (req, res) => {
  console.log("Order data:", req.body);

  res.send(
    "Thank you for your purchase! Your item will arrive in 5 business days."
  );
});

// Start the server
app.listen(port, () => {
  console.log(`Hall of Manga app listening at http://localhost:${port}`);
});
