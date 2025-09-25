const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

require('dotenv').config();

const DATABASE_NAME = process.env.DATABASE_NAME;
const MONGODB_URI = process.env.MONGODB_URI;

async function importData() {
  const uri = MONGODB_URI
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db(DATABASE_NAME);
    const collection = database.collection("IngredientCategories");
    const collection2 = database.collection("DishCategories");
    const ingredientTemplatesCollection = database.collection(
      "IngredientTemplates"
    );
    const ingredientsCollection = database.collection("Ingredients");
    const dishesCollection = database.collection("Dishes");
    const usersCollection = database.collection("Users");
    const ordersCollection = database.collection("Orders");
    const tipCollection = database.collection("Tips");
    const tablesCollection = database.collection("Tables");
    const ingredientWasteCollection = database.collection("ingredient-wastes");

    const ingredientCategories = [
      { name: "wszystkie" },
      { name: "warzywo" },
      { name: "owoc" },
      { name: "mieso" },
      { name: "owoce morza" },
      { name: "produkt zbozowy" },
      { name: "nabial i jajka" },
      { name: "przyprawa" },
      { name: "oleje i tluscze" },
      { name: "przetwor" },
      { name: "mrozonka" },
      { name: "soki i wody" },
    ];

    const dishCategories = [
      { name: "wszystkie" },
      { name: "przystawka" },
      { name: "danie główne" },
      { name: "pizza" },
      { name: "ryba" },
      { name: "zupa" },
      { name: "napoj" },
      { name: "alkohol" },
      { name: "deser" },
    ];

    const ingredients = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Makaron",
        category: "produkt zbozowy",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Marchewka",
        category: "warzywo",
        image: "marchewka.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Jabłko",
        category: "owoc",
        image: "jablko.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kurczak",
        category: "mieso",
        image: "kurczak.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Łosoś",
        category: "owoce morza",
        image: "losos.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Mleko",
        category: "nabial i jajka",
        image: "mleko.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Pomidor",
        category: "warzywo",
        image: "pomidor.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Gruszka",
        category: "owoc",
        image: "gruszka.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Wołowina",
        category: "mieso",
        image: "wolowina.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Krewetki",
        category: "owoce morza",
        image: "krewetki.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ser",
        category: "nabial i jajka",
        image: "ser.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ogórek",
        category: "warzywo",
        image: "ogorek.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Truskawka",
        category: "owoc",
        image: "truskawka.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Indyk",
        category: "mieso",
        image: "indyk.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Małże",
        category: "owoce morza",
        image: "malze.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Jajko",
        category: "nabial i jajka",
        image: "jajko.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ziemniak",
        category: "warzywo",
        image: "ziemniak.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Cytryna",
        category: "owoc",
        image: "cytryna.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Boczek",
        category: "mieso",
        image: "boczek.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Cukinia",
        category: "warzywo",
        image: "cukinia.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Homar",
        category: "owoce morza",
        image: "homar.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Masło",
        category: "nabial i jajka",
        image: "maslo.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Brokuł",
        category: "warzywo",
        image: "brokul.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Winogrona",
        category: "owoc",
        image: "winogrona.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kaczka",
        category: "mieso",
        image: "kaczka.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Cebula",
        category: "warzywo",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Bazylia",
        category: "przyprawa",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ryż",
        category: "produkt zbozowy",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ciasto na pizzę",
        category: "produkt zbozowy",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Śmietana",
        category: "nabial i jajka",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kałamarnica",
        category: "owoce morza",
        image: "kalamarnica.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Jogurt",
        category: "nabial i jajka",
        image: "jogurt.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kapusta",
        category: "warzywo",
        image: "kapusta.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Malina",
        category: "owoc",
        image: "malina.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Baranina",
        category: "mieso",
        image: "baranina.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ostrygi",
        category: "owoce morza",
        image: "ostrygi.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Pieprz",
        category: "przyprawa",
        image: "pieprz.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Sól",
        category: "przyprawa",
        image: "sol.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Cynamon",
        category: "przyprawa",
        image: "cynamon.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Oliwa z oliwek",
        category: "oleje i tluscze",
        image: "oliwa.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Masło klarowane",
        category: "oleje i tluscze",
        image: "maslo_klarowane.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Olej kokosowy",
        category: "oleje i tluscze",
        image: "olej_kokosowy.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Dżem truskawkowy",
        category: "przetwor",
        image: "dzem.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Koncentrat pomidorowy",
        category: "przetwor",
        image: "koncentrat.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ogórki konserwowe",
        category: "przetwor",
        image: "ogorki_konserwowe.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Zamrożony groszek",
        category: "mrozonka",
        image: "groszek.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Mrożone frytki",
        category: "mrozonka",
        image: "frytki.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Mrożony szpinak",
        category: "mrozonka",
        image: "szpinak.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Sok pomarańczowy",
        category: "soki i wody",
        image: "sok.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Woda mineralna",
        category: "soki i wody",
        image: "woda.jpg",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Sok jabłkowy",
        category: "soki i wody",
        image: "sok_jablkowy.jpg",
      },
    ];

    const dishes = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Spaghetti Bolognese",
        price: 25.99,
        image: "uploads/images/spaghetti_bolognese.jpeg",
        category: "danie główne",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Makaron"),
            weight: "200",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Wołowina"),
            weight: "150",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pomidor"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Cebula"),
            weight: "50",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kurczak z ryżem",
        price: 22.5,
        image: "uploads/images/kurczak_z_ryzem.jpg",
        category: "danie główne",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Ryż"),
            weight: "200",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Kurczak"),
            weight: "150",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Marchewka"),
            weight: "50",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Cukinia"),
            weight: "50",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Pizza Margherita",
        price: 18.99,
        image: "uploads/images/pizza_margherita.jpg",
        category: "pizza",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Ciasto na pizzę"),
            weight: "300",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Ser"),
            weight: "150",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pomidor"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Bazylia"),
            weight: "10",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Zupa pomidorowa",
        price: 12.0,
        image: "uploads/images/zupa_pomidorowa.jpeg",
        category: "zupa",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Pomidor"),
            weight: "300",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Makaron"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Cebula"),
            weight: "50",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Śmietana"),
            weight: "50",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Sałatka owocowa",
        price: 15.5,
        image: "uploads/images/salatka_owocowa.jpg",
        category: "deser",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Jabłko"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Winogrona"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Truskawka"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Jogurt"),
            weight: "50",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kurczak pieczony z ziemniakami",
        price: 28.5,
        image: "uploads/images/kurczak_pieczony_z_ziemniakami.jpg",
        category: "danie główne",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Kurczak"),
            weight: "300",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Ziemniak"),
            weight: "200",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Oliwa z oliwek"),
            weight: "20",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pieprz"),
            weight: "5",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Sól"),
            weight: "5",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Sałatka grecka",
        price: 18.99,
        image: "uploads/images/salatka_grecka.jpg",
        category: "przystawka",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Ogórek"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pomidor"),
            weight: "100",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Ser"),
            weight: "80",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Oliwa z oliwek"),
            weight: "15",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pieprz"),
            weight: "5",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Tatar wołowy",
        price: 32.0,
        image: "uploads/images/tatar_wolowy.jpg",
        category: "przystawka",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Wołowina"),
            weight: "150",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Jajko"),
            weight: "50",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Ogórki konserwowe"),
            weight: "50",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Cebula"),
            weight: "30",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pieprz"),
            weight: "5",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Sól"),
            weight: "5",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Zupa krem z brokułów",
        price: 14.99,
        image: "uploads/images/zupa_krem_brokulow.jpg",
        category: "zupa",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Brokuł"),
            weight: "300",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Śmietana"),
            weight: "50",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Zamrożony groszek"),
            weight: "50",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Pieprz"),
            weight: "5",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Sól"),
            weight: "5",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Grillowana kaczka z jabłkami",
        price: 39.99,
        image: "uploads/images/grillowana_kaczka_z_jablkami.jpg",
        category: "danie główne",
        ingredientTemplates: [
          {
            ingredient: ingredients.find((i) => i.name === "Kaczka"),
            weight: "250",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Jabłko"),
            weight: "150",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Masło klarowane"),
            weight: "20",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Cynamon"),
            weight: "5",
          },
          {
            ingredient: ingredients.find((i) => i.name === "Sól"),
            weight: "5",
          },
        ],
        isAvailable: true,
        isBlocked: false,
      },
    ];

    const detailedIngredients = ingredients.flatMap((template) => {
      const count = Math.floor(Math.random() * 3) + 1;
      return Array.from({ length: count }, () => {
        const weight = Math.floor(Math.random() * 500) + 100;
        const price = parseFloat((Math.random() * 20 + 5).toFixed(2));
        return {
          name: template.name,
          price: price,
          weight: weight,
          addedDate: new Date(),
          expirationDate: new Date(
            Date.now() +
              Math.floor(Math.random() * 10 + 5) * 24 * 60 * 60 * 1000
          ),
          category: template.category,
          priceRatio: parseFloat((price / weight).toFixed(2)),
        };
      });
    });

    const users = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Jan",
        surname: "Kowalski",
        email: "jan.kowalski@restaurant.com",
        password: "Admin123",
        pesel: "12345678901",
        image: "admin.jpg",
        role: "admin",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Anna",
        surname: "Nowak",
        email: "anna.nowak@restaurant.com",
        password: "Kelner123",
        pesel: "98765432109",
        image: "kelnerka.jpg",
        role: "waiter",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Piotr",
        surname: "Wiśniewski",
        email: "piotr.wisniewski@restaurant.com",
        password: "Kucharz123",
        pesel: "11223344556",
        image: "kucharz.jpg",
        role: "cook",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Ewa",
        surname: "Zielińska",
        email: "ewa.zielinska@restaurant.com",
        password: "Kelner456",
        pesel: "66554433221",
        image: "kelnerka.jpg",
        role: "waiter",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Krzysztof",
        surname: "Nowicki",
        email: "krzysztof.nowicki@restaurant.com",
        password: "Kucharz456",
        pesel: "99887766554",
        image: "kucharz.jpg",
        role: "cook",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Marta",
        surname: "Kowalczyk",
        email: "marta.kowalczyk@restaurant.com",
        password: "Kelner789",
        pesel: "22334455667",
        image: "kelnerka.jpg",
        role: "waiter",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Józef",
        surname: "Kiwior",
        email: "jozef.kiwior@restaurant.com",
        password: "Kelner733",
        pesel: "22334423667",
        image: "kelner.jpg",
        role: "waiter",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Kamil",
        surname: "Nawrocki",
        email: "kamil.nawrocki@restaurant.com",
        password: "Kucharz116",
        pesel: "96737766554",
        image: "kucharz.jpg",
        role: "cook",
        dishCart: { items: [] },
        ingredientCart: { items: [] },
      },
    ];

    // Dodaj po definicji detailedIngredients:
const ingredientWaste = ingredients.flatMap((template) => {
  const count = Math.floor(Math.random() * 3) + 1; // od 1 do 3 rekordów
  return Array.from({ length: count }, () => {
    const weight = Math.floor(Math.random() * 400) + 50; // 50-450g
    const price = parseFloat((Math.random() * 15 + 2).toFixed(2)); // 2-17 zł
    const daysAgo = Math.floor(Math.random() * 15) + 3; // 3-18 dni temu dodane
    const expiredDaysAgo = Math.floor(Math.random() * 10) + 1; // przeterminowane 1-10 dni temu
    
    return {
      name: template.name,
      price: price,
      weight: weight,
      addedDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      expirationDate: new Date(Date.now() - expiredDaysAgo * 24 * 60 * 60 * 1000),
      category: template.category,
      priceRatio: parseFloat((price / weight).toFixed(2)),
    };
  });
});

    const hashPasswords = async (users) => {
      const updatedUsers = [];

      for (let user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 12);

        updatedUsers.push({
          ...user,
          password: hashedPassword,
        });
      }

      return updatedUsers;
    };

    const orders = Array.from({ length: 200 }, () => {
      const waiters = users.filter((user) => user.role === "waiter");
      const randomWaiter = waiters[Math.floor(Math.random() * waiters.length)];

      const cooks = users.filter((user) => user.role === "cook");
      const randomCook = cooks[Math.floor(Math.random() * cooks.length)];

      const numberOfDishes = Math.floor(Math.random() * 5) + 1;

      const getRandomCookTime = () => {
        const minTime = 15 * 60 * 1000;
        const maxTime = 60 * 60 * 1000;
        return Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
      };

      const getRandomDate = () => {
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);

        const endDate = new Date();

        const randomTime =
          startDate.getTime() +
          Math.random() * (endDate.getTime() - startDate.getTime());
        return new Date(randomTime);
      };

      const orderDate = getRandomDate();

      const randomDishes = Array.from({ length: numberOfDishes }, () => {
        const randomDish = dishes[Math.floor(Math.random() * dishes.length)];
        const randomQuantity = Math.floor(Math.random() * 3) + 1;

        return {
          dish: randomDish,
          quantity: randomQuantity,
          status: "wydane",
          preparedBy: randomCook._id,
          doneByCookDate: new Date(orderDate.getTime() + getRandomCookTime()),
        };
      });

      const totalPrice = randomDishes.reduce(
        (sum, item) => sum + item.dish.price * item.quantity,
        0
      );

      return {
        _id: new mongoose.Types.ObjectId(),
        dishes: randomDishes,
        user: {
          name: `${randomWaiter.name} ${randomWaiter.surname}`,
          userId: randomWaiter._id,
        },
        price: totalPrice.toFixed(2),
        orderDate: orderDate,
        tableNumber: (Math.floor(Math.random() * 5) + 1).toString(),
      };
    });

    const tips = orders
      .map((order) => {
        const hasTip = Math.random() < 0.5;
        if (hasTip) {
          const tipAmount = Math.floor(Math.random() * 50) + 1;
          const randomWaiterId = order.user.userId;

          return {
            amount: tipAmount,
            order: order._id,
            user: randomWaiterId,
          };
        }
        return null;
      })
      .filter((tip) => tip !== null);

    const tables = Array.from({ length: 5 }, (_, index) => ({
      number: index + 1,
      status: "free",
      order: null,
      dishCart: {
        items: [],
      },
    }));

    const insertedTips = await tipCollection.insertMany(tips);
    const insertedOrders = await ordersCollection.insertMany(orders);
    const insertedUsers = await usersCollection.insertMany(
      await hashPasswords(users)
    );
    await collection.insertMany(ingredientCategories);
    const dishCategoriesResult = await collection2.insertMany(dishCategories);
    const ingredientInsertResult =
      await ingredientTemplatesCollection.insertMany(ingredients);
    const detailedIngredientInsertResult = await ingredientsCollection.insertMany(detailedIngredients);
    const dishInsertResult = await dishesCollection.insertMany(dishes);
    const tablesInsertResult = await tablesCollection.insertMany(tables);
    const ingredientWasteInsertResult = await ingredientWasteCollection.insertMany(ingredientWaste);



    console.log(
      `${dishCategoriesResult.insertedCount} kategorii dan zaimportowano.`
    );
    console.log(`${insertedOrders.insertedCount} zamowien dan zaimportowano.`);
    console.log(`${insertedTips.insertedCount} napiwkow dan zaimportowano.`);
    console.log(
      `${ingredientInsertResult.insertedCount} szablonów składników zaimportowano.`
    );
    console.log(
      `${detailedIngredientInsertResult.insertedCount} składników zaimportowano.`
    );
    console.log(
      `${detailedIngredients.length} szczegółowych składników zaimportowano.`
    );
    console.log(`${dishInsertResult.insertedCount} dań zaimportowano.`);
    console.log(
      `${insertedUsers.insertedCount} użytkowników zostało zaimportowanych.`
    );
    console.log(
      `${tablesInsertResult.insertedCount} stolow zostało zaimportowanych.`
    );
    console.log(`${ingredientWasteInsertResult.insertedCount} składników odpadowych zaimportowano.`);
  } finally {
    await client.close();
  }
}

importData().catch(console.error);
