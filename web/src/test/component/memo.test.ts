import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'
import Memo from "@/components/Memo";
import { memo } from 'react';

interface Props {
  memo: Memo;
  readonly?: boolean;
}


test('loads and displays greeting', async () => {
  // ARRANGE
  const memoData:Memo = {
    id: 1,
    creatorId: 1,
    createdTs: 1,
    updatedTs: 1,
    rowStatus: 'ACTIVE' as RowStatus,
    content: 'hello there',
    visibility: 'PUBLIC',
    pinned: false,
    creatorName: 'test',
    resourceList: []
  
  }
  render(<Memo memo={memoData} ></Memo>)

  // ASSERT
  expect(screen.getByRole('heading')).toHaveTextContent('hello there')
  expect(screen.getByRole('button')).toBeDisabled()
})