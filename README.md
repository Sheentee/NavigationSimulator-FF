# Navigation Simulator

A powerful, modern browser extension that allows you to configure and automate a series of navigation steps with custom methods and delays.

![Navigation Simulator Interface](icons/icon128.png)

## Features

- **Multiple Navigation Steps**: Configure an arbitrary number of navigation actions in a sequence.
- **HTTP Method Selection**: Choose between GET and POST for each individual step.
- **Custom POST Bodies**: Send custom JSON or text data payloads with your POST requests.
- **Step-Specific Delays**: Set unique delays for each step in your series to simulate complex user flows.
- **Infinite Looping**: Automatically restarts the navigation sequence from the beginning after the final step.
- **Modern UI**: A premium, dark-mode design with glassmorphism elements and smooth transitions.
- **Persistent State**: Independently remembers your configuration and progress for each tab.
- **Loop Counter**: Keep track of how many full navigation cycles have been completed.

## Installation

### Firefox Browser Add-ons

https://addons.mozilla.org/en-US/firefox/addon/navigation-simulator/

### Chrome Web Store

https://chromewebstore.google.com/detail/navigation-simulator/plmpmpfgpbnjbilfbhkkgkmbggmiclln

### Manual Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Sheentee/NavigationSimulator-FF.git
    ```
2.  **Open Firefox Add-ons**:
    Navigate to `about:debugging#/runtime/this-firefox` in your browser.
3.  **Load Temporary Add-on**:
    Click the **Load Temporary Add-on...** button and select the `manifest.json` file from the `NavigationSimulator` folder.

## Usage

1.  Click on the Navigation Simulator icon in your extension toolbar.
2.  Add your navigation steps by clicking **+ Add New Step**.
3.  For each step, enter the target **URL**, select the **Method** (GET/POST), and set a **Delay** in seconds.
4.  If using POST, enter the desired request body in the text area provided.
5.  Click **Save Config** to store your settings.
6.  Click **Start Navigation** to begin the automated sequence in the current tab.
7.  The loop counter in the header will track your progress as it cycles through the steps.
8.  To stop, simply open the popup again and click **Stop Navigation**.

## License

This project is licensed under the Creative Commons 0 (CC0) 1.0 Universal license. See the [LICENSE](LICENSE) file for details.
