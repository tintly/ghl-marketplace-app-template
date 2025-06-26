/* The above class is a JavaScript GHL helper class that retrieves user data by sending a request to a server and
decrypting the response using a key. */
export class GHL {
  appId;

  constructor() {}

  async getUserData() {
    try {
      const key = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for user data'));
        }, 10000);

        window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
        
        const messageHandler = ({ data }) => {
          if (data.message === "REQUEST_USER_DATA_RESPONSE") {
            clearTimeout(timeout);
            window.removeEventListener("message", messageHandler);
            resolve(data.payload);
          }
        };

        window.addEventListener("message", messageHandler);
      });

      const res = await fetch('/decrypt-sso', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key })
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  }
}