export interface TimeframeBounds {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  type: 'daily' | 'weekly' | 'monthly' | 'persistent';
}

export class TimeframeCalculator {
  static getTimeframeBounds(
    date: string,
    refreshFrequency: string
  ): TimeframeBounds {
    const targetDate = new Date(date);

    switch (refreshFrequency) {
      case 'daily':
        return {
          start: date,
          end: date,
          type: 'daily',
        };

      case 'weekly':
        const monday = this.getMondayOfWeek(targetDate);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          start: this.formatDate(monday),
          end: this.formatDate(sunday),
          type: 'weekly',
        };

      case 'monthly':
        const firstDay = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          1
        );
        const lastDay = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth() + 1,
          0
        );
        return {
          start: this.formatDate(firstDay),
          end: this.formatDate(lastDay),
          type: 'monthly',
        };

      case 'persistent':
        return {
          start: date,
          end: this.formatDate(new Date('9999-12-31')),
          type: 'persistent',
        };

      default:
        throw new Error(`Invalid refresh frequency: ${refreshFrequency}`);
    }
  }

  private static getMondayOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  private static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
