import { fireEvent, render, screen } from "@testing-library/react";
import { DialogList } from "./DialogList";

describe("DialogList", () => {
  it("renders list and triggers onAction", () => {
    const onAction = jest.fn();
    render(
      <DialogList list={["ep1", "ep2"]} parentId="series1" onAction={onAction} />
    );

    const item = screen.getByText("ep1");
    fireEvent.click(item);

    expect(onAction).toHaveBeenCalledWith("series1__ep1", true);
  });
});
