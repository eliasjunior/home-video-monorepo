import axios from "axios";

export async function loadRemoteJsonFile(url) {
  try {
    const response = await axios.get(url);

    if (response.status === 200) {
      // Assuming the response data is a JSON object
      const jsonData = response.data;
      return jsonData;
    } else {
      throw new Error("Failed to retrieve JSON data");
    }
  } catch (error) {
    throw new Error(`Error: ${error.message}`);
  }
}
