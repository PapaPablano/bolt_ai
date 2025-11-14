import { Modal } from './Modal';
import { ComparisonWorkbench } from './ComparisonWorkbench';

interface ComparisonModeProps {
  initialSymbol: string;
  onClose: () => void;
}

export function ComparisonMode({ initialSymbol, onClose }: ComparisonModeProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Compare Stocks" size="xl">
      <ComparisonWorkbench initialSymbols={[initialSymbol]} variant="modal" />
    </Modal>
  );
}
