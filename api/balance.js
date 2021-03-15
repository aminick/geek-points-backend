import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

export default async (req, res) => {
  try {
    req.query.customer_id = BigInt(req.query.customer_id);
    const { customer_id } = req.query;
    const balance = await prisma.transaction.aggregate({
      where: {
        customer_id,
      },
      sum: {
        value: true,
      },
    });
    res.status(200).json(balance);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
};
