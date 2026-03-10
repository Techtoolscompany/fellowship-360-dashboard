import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
  const genAI = new GoogleGenerativeAI("AIzaSyBG4iO6uPqVUUDYXKc5S_Vzn9gDgfphIFY");
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  try {
    const result = await model.generateContent("Hello, world!");
    console.log(result.response.text());
  } catch (error) {
    console.error("ERROR:", error);
  }
}
main();
