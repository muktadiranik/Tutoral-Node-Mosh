getCustomer(1, (customer) => {
  console.log(customer);
  if (customer.isGold) {
    getTopMovies((movies) => {
      console.log(movies);
      sendEmails(customer.email, customer.name, movies, () => {
        console.log("Email sent");
      });
    });
  }
});

function getCustomer(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({
        id: 1,
        name: "Mosh Hamedani",
        isGold: true,
        email: "email",
      });
    }, 1000);
  });
}

function getTopMovies(email, movies, callback) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(["Terminator", "Forrest Gump", "When Harry Met Sally"]);
    }, 1000);
  });
}

function sendEmails(email, name, movies) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log("Email sent");
    }, 1000);
  });
}

async function notifyUsers() {
  const customer = await getCustomer(1);
  console.log(customer);
  if (customer.isGold) {
    const movies = await getTopMovies();
    console.log(movies);
    await sendEmails(customer.email, customer.name, movies);
  }
}

notifyUsers();
