import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'
import Memo from "@/components/Memo";

test('loads and displays greeting', async () => {
  // ARRANGE
  render(<Memo />)

  // ASSERT
  expect(screen.getByRole('heading')).toHaveTextContent('hello there')
  expect(screen.getByRole('button')).toBeDisabled()
})