const Order = require("../models/order");
const User = require("../models/user");
const mongoose = require("mongoose");
const Tip = require("../models/tip");

exports.calculateMonthlyOrderDifferences = (req, res, next) => {
  try {
    const orders = [
      100, 120, 90, 105, 130, 110, 100, 150, 140, 120, 135, 125, 105, 115, 95,
      110, 140, 130, 110, 160, 145, 130, 150, 140,
    ];

    const differences = [];
    for (let i = 0; i < orders.length - 1; i++) {
      differences[i] = (orders[i + 1] / orders[i]) * 100;
    }

    const previousYears = [];
    for (let i = 0; i < 12; i++) {
      previousYears[i] = (orders[i] + orders[i + 12]) / 2;
    }

    const currentYear = [110, 130, 85, 125];

    let totalDifference = 0;
    for (let i = 0; i < currentYear.length; i++) {
      const difference = currentYear[i] - previousYears[i];
      totalDifference += difference;
    }

    const actualDifference = totalDifference / currentYear.length;

    const updatedPredictions = previousYears.map(
      (monthlyOrder) => monthlyOrder + actualDifference
    );

    res.status(200).json({
      message: "Obliczenia zakończone sukcesem.",
      orders,
      differences,
      previousYears,
      currentYear,
      updatedPredictions,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania prognoz zamówień." });
  }
};

exports.getDishesCountWithTopCook = async (req, res, next) => {
  try {
    const currentDate = new Date();

    const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
    const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
    const dayOfWeek = todayStart.getDay();

    const weekStart = new Date(todayStart);
    weekStart.setDate(
      todayStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    );
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + (7 - dayOfWeek));
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const monthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const yearEnd = new Date(
      currentDate.getFullYear(),
      11,
      31,
      23,
      59,
      59,
      999
    );

    const today = new Date();
    let yearStart = new Date(today);
    yearStart.setMonth(today.getMonth() - 12);
    yearStart.setDate(1);

    const orders = await Order.find();

    const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
    const cookDishCount = {};

    orders.forEach((order) => {
      order.dishes.forEach((dish) => {
        const doneByCookDate = new Date(dish.doneByCookDate);

        if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
          counts.today += dish.quantity;
        }
        if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
          counts.lastWeek += dish.quantity;
        }
        if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
          counts.lastMonth += dish.quantity;
        }
        if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
          counts.lastYear += dish.quantity;
        }

        if (dish.preparedBy) {
          const cookId = dish.preparedBy.toString();
          if (!cookDishCount[cookId]) {
            cookDishCount[cookId] = 0;
          }
          cookDishCount[cookId] += dish.quantity;
        }
      });
    });

    console.log("Today range: ", todayStart, todayEnd);
    console.log("Week range: ", weekStart, weekEnd);
    console.log("Month range: ", monthStart, monthEnd);
    console.log("Year range: ", yearStart, yearEnd);

    const cookRanking = await Promise.all(
      Object.entries(cookDishCount).map(async ([cookId, dishCount]) => {
        const user = await User.findById(cookId).select("name");
        return {
          cookId,
          cookName: user ? user.name : "Nieznany",
          dishCount,
        };
      })
    );

    cookRanking.sort((a, b) => b.dishCount - a.dishCount);

    const cooks = await User.find({ role: "cook" }).select("name email");

    res.status(200).json({
      message: "Liczba dań w zamówieniach oraz ranking kucharzy.",
      counts: counts,
      cookRanking: cookRanking,
      cooks: cooks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message:
        "Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.",
    });
  }
};

exports.getCooks = async (req, res, next) => {
  try {
    const cooks = await User.find({ role: "cook" });

    if (!cooks || cooks.length === 0) {
      return res.status(404).json({ message: "No cooks found." });
    }

    res.status(200).json({ users: cooks });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "An error occurred while retrieving cooks." });
  }
};

exports.getWaiters = async (req, res, next) => {
  try {
    const waiters = await User.find({ role: "waiter" });

    const waiterData = await Promise.all(
      waiters.map(async (waiter) => {
        const orders = await Order.find({ "user.userId": waiter._id });

        const orderIds = orders.map(
          (order) => new mongoose.Types.ObjectId(order._id)
        );
        console.log("Converted Order IDs:", orderIds);
        console.log("Waiter user._id:", waiter._id);

        const tips = await Tip.find({
          order: { $in: orderIds.map((id) => id.toString()) },
          user: waiter._id.toString(),
        });

        console.log("Tips for waiter:", tips);

        const totalTips = tips.reduce((acc, tip) => acc + tip.amount, 0);

        const averageTip = orders.length > 0 ? totalTips / orders.length : 0;

        return {
          waiterId: waiter._id,
          waiterName: waiter.name,
          surname: waiter.surname,
          totalTips,
          averageTip,
          image: waiter.image,
          orderCount: orders.length,
        };
      })
    );

    res.status(200).json({ waiters: waiterData });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message:
        "Wystąpił błąd podczas pobierania kelnerów i ich średnich napiwków.",
    });
  }
};
