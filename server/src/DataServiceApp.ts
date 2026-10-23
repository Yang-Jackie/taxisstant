class DataServiceApp {
  static main(): void {
    const port = Number(process.env.PORT ?? "3000");

    if (!Number.isInteger(port) || port <= 0)
    {
        throw new Error(`PORT must be a positive whole number, got "${process.env.PORT}"`)
    }

    console.log(`Data service starting on port ${port}`);
  }
}

DataServiceApp.main();
