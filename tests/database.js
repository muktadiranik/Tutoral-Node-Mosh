const getCustomerSync = (id) => {
  console.log("reading a customer from database");
  return {
    id: id,
    points: 5,
  };
};

const getCustomer = async (id) => {
  return new Promise((resolve, reject) => {
    console.log("reading a customer from database");
    resolve({ id: id, points: 5 });
  });
};

export default { getCustomerSync, getCustomer };
